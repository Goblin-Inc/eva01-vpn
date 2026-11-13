const net = require('net');
const readline = require('readline');
const { Tun } = require('tuntap2');
const { encrypt } = require('./crypto-helper');

const SERVER_HOST = '127.0.0.1';
const SERVER_PORT = 8080;

// Переменные состояния VPN
let isRunning = false;
let vpnSocket = null;
let tunInterface = null;
const logBuffer = []; // Буфер для прокрутки логов в терминале
const MAX_LOGS = 10;   // Сколько строк логов показывать на дисплее

// ANSI-цвета для стилизации под интерфейс NERV
const COLOR_ORANGE = '\x1b[38;5;202m';
const COLOR_PURPLE = '\x1b[38;5;129m';
const COLOR_GREEN  = '\x1b[38;5;46m';
const COLOR_CYAN   = '\x1b[38;5;51m';
const COLOR_GRAY   = '\x1b[38;5;244m';
const COLOR_RED    = '\x1b[38;5;196m';
const STYLE_BOLD   = '\x1b[1m';
const STYLE_RESET  = '\x1b[0m';

// Функция вывода логов на наш тактический дисплей
function logToTui(type, text) {
    const time = new Date().toLocaleTimeString();
    let typeColor = COLOR_CYAN;
    
    if (type === 'success') typeColor = COLOR_GREEN;
    if (type === 'warn') typeColor = COLOR_RED;
    if (type === 'packet') typeColor = COLOR_PURPLE;

    const formattedLog = ` ${COLOR_GRAY}[${time}]${STYLE_RESET} ${typeColor}[${type.toUpperCase()}]${STYLE_RESET} ${text}`;
    
    logBuffer.push(formattedLog);
    if (logBuffer.length > MAX_LOGS) {
        logBuffer.shift(); // Удаляем самый старый лог, чтобы не переполнять экран
    }
    
    renderDashboard();
}

// Отрисовка красивого тактического интерфейса в консоли
function renderDashboard() {
    // Очищаем консоль и возвращаем курсор в верхний левый угол
    process.stdout.write('\x1b[2J\x1b[H');

    const statusText = isRunning 
        ? `${COLOR_GREEN}${STYLE_BOLD}ACTIVE / SECURE${STYLE_RESET}` 
        : `${COLOR_RED}${STYLE_BOLD}IDLE / UNPROTECTED${STYLE_RESET}`;

    const ipText = isRunning ? `${COLOR_GREEN}10.0.0.2 / 24${STYLE_RESET}` : `${COLOR_GRAY}N/A${STYLE_RESET}`;

    console.log(`${COLOR_ORANGE}┌────────────────────────────────────────────────────────┐${STYLE_RESET}`);
    console.log(`${COLOR_ORANGE}│${STYLE_RESET}  ${STYLE_BOLD}NERV TACTICAL SYSTEM  ::  EVA-01 VPN CONTROL PANEL${STYLE_RESET}     ${COLOR_ORANGE}│${STYLE_RESET}`);
    console.log(`${COLOR_ORANGE}├────────────────────────────────────────────────────────┤${STYLE_RESET}`);
    console.log(`${COLOR_ORANGE}│${STYLE_RESET}  SYSTEM STATUS : [ ${statusText} ]                       ${COLOR_ORANGE}│${STYLE_RESET}`);
    console.log(`${COLOR_ORANGE}│${STYLE_RESET}  TUN IP ADDR   : ${ipText}                             ${COLOR_ORANGE}│${STYLE_RESET}`);
    console.log(`${COLOR_ORANGE}│${STYLE_RESET}  SERVER HOST   : ${COLOR_ORANGE}${SERVER_HOST}:${SERVER_PORT}${STYLE_RESET}                        ${COLOR_ORANGE}│${STYLE_RESET}`);
    console.log(`${COLOR_ORANGE}│${STYLE_RESET}  ENCRYPTION    : ${COLOR_CYAN}AES-256-GCM (NERV AUTH TAG)${STYLE_RESET}              ${COLOR_ORANGE}│${STYLE_RESET}`);
    console.log(`${COLOR_ORANGE}├────────────────────────────────────────────────────────┤${STYLE_RESET}`);
    console.log(`${COLOR_ORANGE}│${STYLE_RESET}  ${COLOR_ORANGE}${STYLE_BOLD}[ SPACE ]${STYLE_RESET} TO TOGGLE VPN   |   ${COLOR_RED}${STYLE_BOLD}[ CTRL+C ]${STYLE_RESET} TO EXIT COCKPIT ${COLOR_ORANGE}│${STYLE_RESET}`);
    console.log(`${COLOR_ORANGE}└────────────────────────────────────────────────────────┘${STYLE_RESET}`);
    console.log(`${COLOR_ORANGE}[ TACTICAL MONITOR LOGS ]${COLOR_GRAY} ────────────────────────────────${STYLE_RESET}\n`);

    // Выводим прокручиваемые логи
    for (let i = 0; i < MAX_LOGS; i++) {
        if (logBuffer[i]) {
            console.log(logBuffer[i]);
        } else {
            console.log(''); // Пустая строка для сохранения размеров сетки
        }
    }
}

function startVpn() {
    try {
        isRunning = true;
        logToTui('info', 'Капсула синхронизации инициализирована.');
        logToTui('info', 'Создание виртуального интерфейса eva01...');
        
        tunInterface = new Tun();
        tunInterface.ipv4 = '10.0.0.2/24';
        tunInterface.isUp = true;

        logToTui('success', `Сетевой интерфейс ${tunInterface.name} успешно поднят.`);
        logToTui('info', `Установка защищенного соединения с ядром сервера...`);

        vpnSocket = net.createConnection({ port: SERVER_PORT, host: SERVER_HOST }, () => {
            logToTui('success', 'Синхронизация пройдена! AES-256-GCM туннель удержан.');

            // Перехват пакетов из ОС
            tunInterface.on('data', (packet) => {
                // ПРЕДОХРАНИТЕЛЬ: Если сокет закрыт или уничтожен, игнорируем остаточные пакеты
                if (!vpnSocket || vpnSocket.destroyed) return;

                logToTui('packet', `Перехвачен сетевой пакет ядра: ${packet.length} байт`);
                const securePacket = encrypt(packet);
                vpnSocket.write(securePacket);
            });
        });

        vpnSocket.on('error', (err) => {
            // Если мы сами закрываем сокет, не спамим ошибками
            if (!isRunning) return;
            logToTui('warn', `Связь разорвана: ${err.message}`);
            stopVpn();
        });

        vpnSocket.on('close', () => {
            // Триггерим стоп только если сервер оборвал связь неожиданно
            if (isRunning) {
                logToTui('info', 'Сессия туннеля закрыта сервером.');
                stopVpn();
            }
        });

    } catch (e) {
        logToTui('warn', `Критический сбой запуска: ${e.message}`);
        stopVpn();
    }
}

function stopVpn() {
    if (vpnSocket) {
        vpnSocket.destroy();
        vpnSocket = null;
    }
    if (tunInterface) {
        tunInterface = null;
    }
    isRunning = false;
    logToTui('warn', 'Туннель деактивирован. Система в режиме ожидания.');
}

// Настройка интерактивного прослушивания клавиатуры
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
}

process.stdin.on('keypress', (str, key) => {
    if (key.ctrl && key.name === 'c') {
        stopVpn();
        // Сбрасываем терминал в стандартный режим перед выходом
        process.stdout.write('\x1b[2J\x1b[H');
        process.exit();
    } else if (key.name === 'space') {
        if (!isRunning) {
            startVpn();
        } else {
            stopVpn();
        }
    }
});

// Первичная отрисовка интерфейса при запуске скрипта
logToTui('info', 'Система EVA-01 VPN готова к синхронизации.');
