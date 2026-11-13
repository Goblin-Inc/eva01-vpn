const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const net = require('net');
const { Tun } = require('tuntap2');
const { encrypt } = require('./crypto-helper');

let mainWindow;
let vpnSocket = null;
let tunInterface = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 450,
        height: 480,
        resizable: false,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
}

// Посылаем сообщения в консоль интерфейса index.html
function logToUi(type, text) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('vpn-log', { type, text });
    }
    console.log(`[${type.toUpperCase()}] ${text}`);
}

// Запуск VPN-клиента внутри главного процесса Electron
function startVpn() {
    try {
        logToUi('info', 'Создание виртуального интерфейса eva01...');
        
        tunInterface = new Tun();
        tunInterface.ipv4 = '10.0.0.2/24';
        tunInterface.isUp = true;

        logToUi('success', `Интерфейс поднят! IP: ${tunInterface.ipv4}`);
        logToUi('info', 'Подключение к серверу 127.0.0.1:8080...');

        vpnSocket = net.createConnection({ port: 8080, host: '127.0.0.1' }, () => {
            logToUi('success', 'Туннель удерживается. Защита AES-256-GCM активна!');

            // Слушаем пакеты из ОС и отправляем на сервер в зашифрованном виде
            tunInterface.on('data', (packet) => {
                logToUi('info', `Перехвачено: IP-пакет ${packet.length} байт`);
                const securePacket = encrypt(packet);
                vpnSocket.write(securePacket);
            });
        });

        vpnSocket.on('error', (err) => {
            logToUi('warn', `Ошибка сокета: ${err.message}`);
            stopVpn();
        });

        vpnSocket.on('close', () => {
            logToUi('info', 'Туннель закрыт сервером.');
            stopVpn();
        });

    } catch (e) {
        logToUi('warn', `Сбой инициализации ядра: ${e.message}`);
        stopVpn();
    }
}

// Остановка VPN-клиента
function stopVpn() {
    if (vpnSocket) {
        vpnSocket.destroy();
        vpnSocket = null;
    }
    if (tunInterface) {
        tunInterface = null;
    }
    logToUi('warn', 'Система защиты отключена. Туннель закрыт.');
}

// Управление кнопкой из интерфейса index.html
ipcMain.on('toggle-vpn', (event, start) => {
    if (start) {
        startVpn();
    } else {
        stopVpn();
    }
});

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    stopVpn();
    if (process.platform !== 'darwin') app.quit();
});
