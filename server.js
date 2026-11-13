const net = require('net');
// Импортируем класс Tun
const { Tun } = require('tuntap2');
const { decrypt, encrypt } = require('./crypto-helper');

const PORT = 8080;

try {
    // Инициализируем виртуальную карту на стороне сервера
    const tun = new Tun();
    tun.ipv4 = '10.0.0.1/24';
    tun.isUp = true;

    console.log(`[EVA-01 SERVER] Интерфейс сервера запущен! Имя: ${tun.name}, IP: ${tun.ipv4}`);

    const server = net.createServer((socket) => {
        console.log(`[EVA-01 SERVER] Пилот подключился: ${socket.remoteAddress}`);

        socket.on('data', (data) => {
            const decryptedPacket = decrypt(data);
            if (!decryptedPacket) return;

            // Выплевываем расшифрованный IP-пакет в сетевой стек сервера
            tun.write(decryptedPacket);
        });

        tun.on('data', (packet) => {
            // Ловим ответные пакеты из сети сервера, шифруем и отправляем пилоту в туннель
            const secureResponse = encrypt(packet);
            socket.write(secureResponse);
        });

        socket.on('end', () => console.log('[EVA-01 SERVER] Пилот отключился'));
    });

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`[EVA-01 SERVER] Защищенное ядро слушает порт ${PORT}`);
    });

} catch (e) {
    console.error('❌ Ошибка инициализации интерфейса сервера. Запустили через sudo?', e.message);
}