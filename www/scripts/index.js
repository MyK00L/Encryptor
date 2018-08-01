// For an introduction to the Blank template, see the following documentation:
// http://go.microsoft.com/fwlink/?LinkID=397704
// To debug code on page load in cordova-simulate or on Android devices/emulators: launch your app, set breakpoints, 
// and then run "window.location.reload()" in the JavaScript Console.

var Mkey;
var Mdata = {};
var Moptions = { exitOnPause: true };
var MlastPage = "decrypt";

(function () {
    "use strict";

    document.addEventListener('deviceready', onDeviceReady.bind(this), false);

    function onDeviceReady() {
        // Handle the Cordova pause and resume events
        document.addEventListener('pause', onPause.bind(this), false);
        document.addEventListener('resume', onResume.bind(this), false);

        SHA256_init();
        AES_Init();

        var i = 0;

        var x = document.getElementsByClassName("menu-icon");
        for (i = 0; i < x.length; ++i) {
            x[i].onclick = function () { loadPage("menu"); };
        }

        x = document.getElementsByClassName("menu-entry");
        for (i = 0; i < x.length; ++i) {
            x[i].onclick = function () { loadPage(this.innerHTML); };
        }

        x = document.getElementsByClassName("menu-back-icon");
        for (i = 0; i < x.length; ++i) {
            x[i].onclick = function () { loadPage(window.MlastPage); };
        }

        var y = document.getElementById("decrypt-button");
        y.onclick = function () {
            var pwd = document.getElementById("password").value;
            document.getElementById("password").value = "";
            y.disabled = true;
            document.getElementById("password").disabled = true;
            if (pwd.length < 8) {
                alert("password must be at least 8 characters long");
                y.disabled = false;
                document.getElementById("password").disabled = false;
            } else {
                generateKey(pwd);
                pwd = "";
                try {
                    loadData();
                    saveData();

                    document.getElementById("exit-on-pause-checkbox").checked = window.Moptions.exitOnPause;

                    document.getElementById("entries-table").innerHTML = "";
                    for (var i in window.Mdata) {
                        addRow(i);
                    }

                    loadPage("entries");

                    y.disabled = false;
                    document.getElementById("password").disabled = false;
                } catch (e) {
                    alert("incorrect password");
                    y.disabled = false;
                    document.getElementById("password").disabled = false;
                }
            }
        };

        y = document.getElementById("add-entry-button");
        y.onclick = function () {
            if (!window.Mdata.hasOwnProperty(document.getElementById("new-entry-name").value)) {
                addRow(document.getElementById("new-entry-name").value);
            }
            window.Mdata[document.getElementById("new-entry-name").value] = document.getElementById("new-entry-value").value;
            saveData();
            document.getElementById("new-entry-value").value = "";
            document.getElementById("new-entry-name").value = "";
            loadPage("entries");
        };

        y = document.getElementById("add-button");
        y.onclick = function () {
            loadPage("add-entry");
        };

        y = document.getElementById("exit");
        y.onclick = function () {
            exitApp();
        };

        y = document.getElementById("change-password-button");
        y.onclick = function () {
            var pwd = document.getElementById("new-password").value;
            document.getElementById("new-password").value = "";
            y.disabled = true;
            document.getElementById("new-password").disabled = true;
            if (pwd.length < 8) {
                alert("Password must be at least 8 characters long");
            } else {
                generateKey(pwd);
                saveData();
                alert("changed password succesfully");
                loadPage("decrypt");
            }
            y.disabled = false;
            document.getElementById("new-password").disabled = false;
        };

        y = document.getElementById("exit-on-pause-checkbox");
        y.onclick = function () {
            Moptions.exitOnPause = document.getElementById("exit-on-pause-checkbox").checked;
            saveData();
        };

        document.getElementById("password").focus();
    }

    function exitApp() {
        window.Mdata = {};
        window.Mkey = [];
        if (navigator) {
            if (navigator.app) {
                navigator.app.exitApp();
            } else if (navigator.device) {
                navigator.device.exitApp();
            } else {
                window.close();
            }
        } else {
            window.close();
        }
    }

    function addRow(entryName) {
        var r = document.getElementById("entries-table").insertRow(0);

        var c = r.insertCell(0);
        c.innerHTML = entryName;
        c.className = "entry-name";

        c = r.insertCell(1);
        c.innerHTML = "<img src='images/eye.png' style='opacity:0.8;' />";
        c.onclick = function () { alert(window.Mdata[this.parentNode.cells[0].innerHTML]); };

        c = r.insertCell(2);
        c.innerHTML = "<img src='images/edit.png' />";
        c.onclick = function () {
            document.getElementById("new-entry-name").value = this.parentNode.cells[0].innerHTML;
            loadPage("add-entry");
            document.getElementById("new-entry-value").focus();
        };

        c = r.insertCell(3);
        c.innerHTML = "<img src='images/delete.png' />";
        c.onclick = function () {
            if (confirm("are you sure you want to delete this entry?") === true) {
                delete window.Mdata[this.parentNode.cells[0].innerHTML];
                saveData();
                this.parentNode.parentNode.removeChild(this.parentNode);
            }
        };
    }

    function onPause() {
        if (window.Moptions.exitOnPause === true) {
            loadPage("decrypt");
        }
    }

    function onResume() {

    }

    function loadPage(pageId) {
        if (pageId !== "menu") window.MlastPage = pageId;
        if (pageId === "decrypt") {
            window.Mdata = {};
            window.Mkey = [];
        }
        var x = document.getElementsByClassName("page");
        for (var i = 0; i < x.length; ++i) {
            x[i].style.display = "none";
        }
        var p = document.getElementById(pageId);
        p.style.display = "block";
    }

    function generateSalt() {
        return SHA256_hash((new Date()).valueOf().toString() + Math.random().toString()) + SHA256_hash((new Date()).valueOf().toString() + "MyK_00L" + Math.random().toString());
    }

    function generateKey(pwd) {
        var salt = "";
        if (window.localStorage.getItem("salt") === null) {
            salt = generateSalt();
            window.localStorage.setItem("salt", salt);
        } else {
            salt = window.localStorage.getItem("salt");
        }
        scrypt(pwd, hex_string_to_array(salt), { N: 32768, r: 8 }, function (result) {
            pwd = ""; salt = "";
            window.Mkey = result;
            AES_ExpandKey(window.Mkey);
        });
    }

    function encrypt(message, key) {
        while (message.length % 16 > 0) {
            message += ' ';
        }
        var res = "";
        var ss = "";
        var block;
        for (var i = 0; i < message.length; i += 16) {
            ss = message.substring(i, i + 16);
            block = string_to_array(ss);
            AES_Encrypt(block, key);
            res += array_to_string(block);
        }
        return res;
    }

    function decrypt(message, key) {
        var res = "";
        var ss = "";
        var block;
        for (var i = 0; i < message.length; i += 16) {
            ss = message.substring(i, i + 16);
            block = string_to_array(ss);
            AES_Decrypt(block, key);
            res += array_to_string(block);
        }
        return res;
    }

    function saveData() {
        var str = JSON.stringify(window.Mdata);
        str = encrypt(str, window.Mkey);
        window.localStorage.setItem("data", str);
        window.localStorage.setItem("options", JSON.stringify(window.Moptions));
    }

    function loadData() {
        var str = window.localStorage.getItem("data");
        if (str === null) {
            window.Mdata = {};
            window.Moptions = { exitOnPause: true };
        } else {
            str = decrypt(str, window.Mkey);
            window.Moptions = JSON.parse(localStorage.getItem("options"));
            try {
                window.Mdata = JSON.parse(str);
            } catch (e) {
                throw e;
            }
        }
    }

})();

