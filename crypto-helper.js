const crypto = require('crypto');

// Ключ шифрования (32 байта для AES-256). 
// В будущем мы сделаем генерацию, а пока используем фиксированный для тестов.
const SECRET_KEY = crypto.scryptSync('eva-01-secure-password-synch', 'nerv-salt', 32); 
const ALGORITHM = 'aes-256-gcm';

function encrypt(buffer) {
    // IV (вектор инициализации) должен быть уникальным для каждого пакета
    const iv = crypto.randomBytes(12); 
    const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
    
    // Шифруем данные
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    // Получаем тег аутентификации (проверка целостности данных)
    const authTag = cipher.getAuthTag(); 

    // Склеиваем всё в один пакет: 
    // Длина IV (1 байт) + сам IV + Длина Tag (1 байт) + сам Tag + Зашифрованное тело
    const packet = Buffer.alloc(1 + iv.length + 1 + authTag.length + encrypted.length);
    
    packet.writeUInt8(iv.length, 0);
    iv.copy(packet, 1);
    packet.writeUInt8(authTag.length, 1 + iv.length);
    authTag.copy(packet, 1 + iv.length + 1);
    encrypted.copy(packet, 1 + iv.length + 1 + authTag.length);
    
    return packet;
}

function decrypt(packet) {
    try {
        // Разбираем пакет обратно по байтам
        const ivLength = packet.readUInt8(0);
        const iv = packet.subarray(1, 1 + ivLength);
        
        const tagLength = packet.readUInt8(1 + ivLength);
        const authTag = packet.subarray(1 + ivLength + 1, 1 + ivLength + 1 + tagLength);
        
        const encrypted = packet.subarray(1 + ivLength + 1 + tagLength);
        
        const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
        decipher.setAuthTag(authTag);
        
        return Buffer.concat([decipher.update(encrypted), decipher.final()]);
    } catch (err) {
        console.error('⚠️ КРИТИЧЕСКАЯ ОШИБКА: Обнаружена попытка подмены или повреждения трафика!');
        return null;
    }
}

module.exports = { encrypt, decrypt };