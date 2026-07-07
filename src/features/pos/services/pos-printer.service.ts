export type PrinterConnectionType = 'bluetooth' | 'lan' | 'simulator';

export interface PrinterConfig {
    type: PrinterConnectionType;
    ipAddress?: string; // For LAN
}

export class POSPrinterService {
    private static bluetoothCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

    /**
     * Tries to connect to a Bluetooth printer using Web Bluetooth API.
     */
    static async connectBluetooth(): Promise<boolean> {
        try {
            if (!navigator.bluetooth) {
                throw new Error('Web Bluetooth is not supported in this browser.');
            }

            // Standard ESC/POS Bluetooth Service UUIDs (often generic serial port profile)
            // Some common printer UUIDs: 000018f0-0000-1000-8000-00805f9b34fb or 0000e781-0000-1000-8000-00805f9b34fb
            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '0000e781-0000-1000-8000-00805f9b34fb']
            });

            const server = await device.gatt?.connect();
            if (!server) throw new Error('Could not connect to GATT server.');

            // We attempt to find the primary service for writing.
            // In a real production setup, we need the exact UUID of the printer's write characteristic.
            const services = await server.getPrimaryServices();
            if (services.length === 0) throw new Error('No services found on this device.');
            
            const service = services[0];
            const characteristics = await service.getCharacteristics();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            const writeCharacteristic = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);
            
            if (!writeCharacteristic) throw new Error('No writable characteristic found.');

            this.bluetoothCharacteristic = writeCharacteristic;

            return true;
        } catch (error) {
            console.error('Bluetooth connection failed:', error);
            throw error;
        }
    }

    /** True when a Bluetooth printer characteristic is currently held (this session).
     *  Additive read-only helper — does not change existing POS behavior. */
    static isBluetoothConnected(): boolean {
        return this.bluetoothCharacteristic !== null;
    }

    /** Drop the current Bluetooth connection (best-effort GATT disconnect + clear).
     *  Additive helper — safe no-op when nothing is connected. */
    static disconnectBluetooth(): void {
        try {
            this.bluetoothCharacteristic?.service?.device?.gatt?.disconnect();
        } catch {
            /* ignore — clearing the ref below is what matters */
        }
        this.bluetoothCharacteristic = null;
    }

    /**
     * Send raw ESC/POS bytes to the configured printer.
     */
    static async print(config: PrinterConfig, data: Uint8Array): Promise<void> {
        if (config.type === 'simulator') {
            console.log('🖨️ [SIMULATOR PRINTER] Printing Receipt Data...');
            console.log(new TextDecoder().decode(data));
            return;
        }

        if (config.type === 'bluetooth') {
            if (!this.bluetoothCharacteristic) {
                // If not connected, attempt to reconnect or prompt
                throw new Error('Bluetooth printer not connected. Please connect first.');
            }
            try {
                // Web Bluetooth requires sending in small chunks (e.g., 512 bytes)
                const CHUNK_SIZE = 512;
                for (let i = 0; i < data.length; i += CHUNK_SIZE) {
                    const chunk = data.slice(i, i + CHUNK_SIZE);
                    await this.bluetoothCharacteristic.writeValue(chunk);
                }
            } catch (error) {
                console.error('Failed to print via Bluetooth:', error);
                throw new Error('Failed to print via Bluetooth.');
            }
            return;
        }

        if (config.type === 'lan') {
            if (!config.ipAddress) {
                throw new Error('LAN IP Address is required.');
            }
            // Real LAN printing requires a proxy (like QZ Tray) because browsers block raw TCP sockets.
            // For now, we simulate a fetch request to a generic local print spooler/proxy.
            try {
                console.log(`🖨️ [LAN PRINTER] Sending print job to proxy for IP: ${config.ipAddress}`);
                // const response = await fetch('http://localhost:8080/print', {
                //     method: 'POST',
                //     headers: { 'Content-Type': 'application/octet-stream' },
                //     body: data
                // });
                // if (!response.ok) throw new Error('Proxy print failed');
                console.warn('LAN Printing requires a local proxy (like QZ Tray) due to browser TCP restrictions. Simulated success.');
            } catch (error) {
                console.error('LAN print failed:', error);
                throw error;
            }
            return;
        }
    }

    /**
     * Generates a basic ESC/POS receipt payload.
     */
    static generateReceiptPayload(text: string): Uint8Array {
        const encoder = new TextEncoder();
        
        // Basic ESC/POS commands
        const ESC = 0x1B;
        const INIT = [ESC, 0x40]; // Initialize printer
        const ALIGN_CENTER = [ESC, 0x61, 0x01];
        const CUT_PAPER = [0x1D, 0x56, 0x41, 0x00]; // Cut paper command

        const data = [
            ...INIT,
            ...ALIGN_CENTER,
            ...Array.from(encoder.encode(text)),
            0x0A, 0x0A, 0x0A, // Feed 3 lines
            ...CUT_PAPER
        ];

        return new Uint8Array(data);
    }
}
