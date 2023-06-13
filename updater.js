/**
 * @file Updater for Toonboom Harmony Scripts
 * @version 23.5.29
 * @copyright mihgehl < github.com/mihgehl >
 * @author mihgehl < www.comadrejo.com >
 * @license
 * Copyright 2023 Miguel Brito
 * The current script (the "Script") is the exclusive property of Miguel Brito and is protected by copyright laws and international treaty provisions. The Script is licensed, not sold.
 * Subject to the terms and conditions of this license, Miguel Brito grants to the purchaser of the Script (the "Licensee") a non-exclusive, non-transferable license to use the Script for the Licensee's own internal business or personal purposes. Any use of the Script beyond the scope of this license is strictly prohibited.
 * The Licensee is not allowed to copy, modify, distribute, sell, transfer, sublicense, or reverse engineer the Script without the prior written consent of Miguel Brito.
 * The Script is provided "as is" without warranty of any kind, either expressed or implied, including, but not limited to, the implied warranties of merchantability and fitness for a particular purpose. In no event shall Miguel Brito be liable for any direct, indirect, incidental, special, or consequential damages arising out of or in connection with the use or inability to use the Script.
 * This license is effective until terminated. This license will terminate automatically without notice from Miguel Brito if the Licensee fails to comply with any provision of this license. Upon termination, the Licensee must immediately cease all use of the Script.
 * This license shall be governed by and construed in accordance with the laws of Ecuador. Any disputes arising under or in connection with this license shall be resolved by the courts located in Ecuador.
 * By using the Script, the Licensee agrees to be bound by the terms and conditions of this license. If the Licensee does not agree to these terms, they must not use the Script.
 */

/**
 * @param { object } packageInfo Object with information about the current package (from configure.js)
 * @param { bool } debug Print debug messages to Message Log
 */
function Updater(parentContext, packageInfo, onCompleteCallback) {
  if (typeof onCompleteCallback === "undefined") var onCompleteCallback = null;

  this.packageInfo = packageInfo;
  this.debug = packageInfo.debugMode;

  this.parentContext = parentContext;
  this.onCompleteCallback = onCompleteCallback;

  this.connection = new (require(this.packageInfo.packageFolder +
    "/lib/Network/network.js").Connection)();

  if (
    this.packageApiResponse.assets &&
    this.packageApiResponse.assets[0] &&
    this.packageApiResponse.assets[0].browser_download_url
  ) {
    this.packageRemoteVersion = this.packageApiResponse.tag_name;
    this.isUpdateAvailable = this.compareVersion(
      this.packageInfo.packageVersion,
      this.packageRemoteVersion
    );
    if (this.isUpdateAvailable) {
      this.log(
        "New Update Found | v" +
          this.packageInfo.packageVersion +
          " to v" +
          this.packageRemoteVersion
      );
      // Comment for fast debug
      this.updateAction = this.addUpdateButtonToToolbar.call(
        this,
        this.packageInfo.packageFullName
      );
      this.updateAction.setVisible(true);
      //
    } else {
      this.log("No Updates found.");
    }
  } else {
    this.log("Update server is down");
  }
}

Object.defineProperty(Updater.prototype, "packageApiResponse", {
  get: function () {
    if (typeof this.apiAnswer === "undefined") {
      var response = this.connection.get(this.packageInfo.packageApiURL);
      this.apiAnswer = response;
      return response;
    } else {
      return this.apiAnswer;
    }
  },
});

Updater.prototype.compareVersion = function (currentVersion, incomingVersion) {
  const currentParts = currentVersion.split(".");
  const incomingParts = incomingVersion.split(".");
  for (var i = 0; i < incomingParts.length; i++) {
    const a = ~~incomingParts[i];
    const b = ~~currentParts[i];
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
};

Updater.prototype.addUpdateButtonToToolbar = function (packageFullName) {
  try {
    var widgets = QApplication.allWidgets();
    var toolbar = widgets.filter(function (x) {
      return x.objectName == packageFullName.replace(/ /g, "_");
    })[0];
    var updateAction = new QAction("");

    var updateActionText = "Update Available\n(Click Here)";
    updateAction.iconText = updateActionText;
    updateAction.text = updateActionText;
    updateAction.setVisible(false);
    toolbar.addActions([updateAction]);

    toolbar.actionTriggered.connect(this, function (triggered) {
      try {
        if (triggered.text == updateActionText) {
          this.updateInfoUI.call(this);
        }
      } catch (error) {
        this.log(error);
      }
    });

    return updateAction;
  } catch (error) {
    this.log(error);
  }
};

Updater.prototype.updateInfoUI = function () {
  try {
    this.ui = UiLoader.load(
      this.packageInfo.packageFolder + "/lib/Updater/updater.ui"
    );
    this.ui.setWindowTitle(" ");
    this.ui.stackedWidget.info.updateTitle.setText(
      this.packageInfo.packageShortName + " Update Available"
    );
    this.ui.stackedWidget.info.changelog.title =
      "New Version: " + this.packageApiResponse.tag_name;
    this.ui.stackedWidget.info.changelog.changelogText.setText(
      this.packageApiResponse.body
    );
    this.ui.stackedWidget.setCurrentWidget(this.ui.stackedWidget.info);

    this.ui.show();
    this.ui.activateWindow(); // Set current window to the top

    this.ui.stackedWidget.info.updateButton.clicked.connect(this, function () {
      this.update.call(this);
    });
    this.ui.stackedWidget.done.closeAfterUpdate.clicked.connect(
      this,
      function () {
        try {
          if (!typeof this.onCompleteCallback == "null") {
            this.onCompleteCallback.call(this.parentContext);
          }
        } catch (error) {
          MessageLog.trace(error);
        }
      }
    );
  } catch (error) {
    MessageLog.trace(error);
  }
};

Updater.prototype.update = function () {
  // Chained functions that get executed asynchronously, one after another
  this.updateDownload.call(
    this,
    (onDownloadComplete = function (updateFile) {
      this.updateInstall.call(this, updateFile);
    })
  );
};

Updater.prototype.updateDownload = function (onDownloadComplete) {
  this.log("Downloading Update...");

  this.ui.stackedWidget.setCurrentWidget(this.ui.stackedWidget.downloading);

  // TODO: Use system temp folder instead
  this.createFolder(this.packageInfo.packageFolder + "/tmp/");
  this.connection.asyncDownload(
    (context = this),
    (url = this.packageApiResponse.assets[0].browser_download_url),
    (destinationPath = this.packageInfo.packageFolder + "/tmp/update.zip"),
    (onSuccessCallback = onDownloadComplete),
    (onErrorCallback = function (errorLog) {
      MessageLog.trace("Download Failed: " + errorLog);
      return;
    })
  );
};

Updater.prototype.updateInstall = function (updateFile) {
  this.log("Installing Update...");

  var onStartCallback = function () {
    this.ui.stackedWidget.setCurrentWidget(this.ui.stackedWidget.installing);
  };

  var progressCallback = function (progressPercentage) {
    this.log("Progress > " + progressPercentage + "%");
  };

  var onEndCallback = function () {
    try {
      var tmpFolderPackage = new QDir(
        tmpFolder.path() + "/packages/" + this.packageInfo.packageName
      );

      if (!tmpFolderPackage.exists()) {
        this.log("Source folder does not exist.");
        this.ui.stackedWidget.setCurrentWidget(this.ui.stackedWidget.info);
        this.log("Updated failed");
        return;
      }
      var currentInstall = new QDir(this.packageInfo.packageFolder);
      currentInstall.removeRecursively();
      this.copyFolderRecursively(
        tmpFolderPackage.path(),
        this.packageInfo.packageFolder
      );
      // TODO: Implement a custom removeRecursively function for filtering out files
      tmpFolder.removeRecursively();
      this.ui.stackedWidget.setCurrentWidget(this.ui.stackedWidget.done);
      this.log("Updated Successfully");
      this.updateAction.setVisible(false);
    } catch (error) {
      this.log(error);
    }
  };

  // Create a temporary folder for unzipping
  var tmpFolder = new QDir(
    specialFolders.temp + "/" + Math.random().toString(36).slice(-8) + "/"
  );
  if (!tmpFolder.exists()) {
    tmpFolder.mkpath(tmpFolder.path());
  }

  try {
    MessageLog.trace("Source File: " + updateFile.fileName());
    MessageLog.trace("Destination: " + tmpFolder.path());
    var unZipper = new (require(this.packageInfo.packageFolder +
      "/lib/FileArchiver/sevenzip.js").SevenZip)(
      (parentContext = this),
      (source = updateFile.fileName()),
      (destination = tmpFolder.path()),
      (processStartCallback = onStartCallback),
      (progressCallback = progressCallback),
      (processEndCallback = onEndCallback),
      (filter = ""),
      (debug = this.debug)
    );

    unZipper.unzipAsync();
  } catch (error) {
    MessageLog.trace(error);
  }
};

// File system handling functions
Updater.prototype.createFolder = function (path) {
  var newFolder = new QDir(path);
  if (!newFolder.exists()) {
    newFolder.mkpath(path);
    this.log(newFolder.path() + " folder created");
  }
};

Updater.prototype.copyFolderRecursively = function (
  sourceFolder,
  destinationFolder
) {
  var sourceDir = new QDir(sourceFolder);
  var destinationDir = new QDir(destinationFolder);

  if (!sourceDir.exists()) {
    this.log("Source folder does not exist.");
    return;
  }

  if (!destinationDir.exists()) {
    destinationDir.mkpath(destinationFolder);
  }

  var fileInfoList = sourceDir.entryInfoList(
    QDir.Filters(QDir.Files | QDir.Dirs | QDir.NoDotAndDotDot)
  );

  for (var i = 0; i < fileInfoList.length; i++) {
    var fileInfo = fileInfoList[i];
    var sourcePath = fileInfo.absoluteFilePath();
    var destinationPath = destinationDir.absoluteFilePath(fileInfo.fileName());

    if (fileInfo.isDir()) {
      this.copyFolderRecursively(sourcePath, destinationPath);
    } else {
      var file = new QFile(sourcePath);
      if (file.exists() && file.copy(destinationPath)) {
        this.log("File copied: " + destinationPath);
      } else {
        this.log("Error copying file: " + destinationPath);
      }
    }
  }
};

Updater.prototype.log = function (stuff) {
  if (this.debug) {
    if (typeof stuff === "object" || typeof stuff === "array") {
      stuff = JSON.stringify(stuff);
    }
    MessageLog.trace("[ " + this.packageInfo.packageFullName + " ] > " + stuff);
  }
};

exports.Updater = Updater;
