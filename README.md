# Eva-01 VPN

> 🌐 **Language:** **English** | [Русский (README_Ru.md)](README_Ru.md)

A tactical VPN client and server built with **Node.js**, **Electron**, and **TUN/TAP (`tuntap2`)**, featuring custom packet encryption and a NERV / Evangelion-inspired desktop interface.

## ✨ Features
- 🛡️ **Network-Layer Tunneling (`tuntap2`)** — creates a virtual TUN/TAP network interface and routes raw IP packets.
- 🔐 **Packet Encryption (`crypto-helper.js`)** — symmetric encryption of payload traffic between client (`client.js`) and server (`server.js`).
- 🖥️ **Electron Desktop GUI (`main.js`, `index.html`)** — tactical control panel for tunnel management and live connection status monitoring.

## 🚀 Installation & Usage

```bash
npm install
```

### Run the Server
```bash
sudo node server.js
```

### Run the Electron Client
```bash
npm start
```
