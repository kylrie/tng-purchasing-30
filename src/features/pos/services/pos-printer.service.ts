import * as qz from 'qz-tray';
import type { POSOrder } from '../types/pos.types';
export type PrinterConnectionType = 'bluetooth' | 'lan' | 'simulator' | 'qz';

export interface PrinterConfig {
    type: PrinterConnectionType;
    ipAddress?: string; // For LAN and QZ
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
     * Sends the generated ESC/POS byte array to the selected printer.
     */
    static async print(config: PrinterConfig, data: Uint8Array): Promise<void> {
        if (config.type === 'simulator') {
            console.log('🖨️ [SIMULATOR PRINTER] Printing simulated receipt...');
            console.log(new TextDecoder().decode(data));
            return;
        }

        if (config.type === 'bluetooth') {
            if (!this.bluetoothCharacteristic) {
                const connected = await this.connectBluetooth();
                if (!connected || !this.bluetoothCharacteristic) {
                    throw new Error('Bluetooth printer is not connected.');
                }
            }
            
            try {
                // Many printers require chunking the data (e.g., 512 bytes at a time)
                const chunkSize = 512;
                for (let i = 0; i < data.length; i += chunkSize) {
                    const chunk = data.slice(i, i + chunkSize);
                    await this.bluetoothCharacteristic.writeValue(chunk);
                }
                console.log('🖨️ [BLUETOOTH PRINTER] Print successful.');
            } catch (error) {
                console.error('Bluetooth print failed:', error);
                throw error;
            }
            return;
        }

        if (config.type === 'qz') {
            if (!config.ipAddress) {
                throw new Error('Printer Name or IP Address is required for QZ Tray.');
            }
            try {
                console.log(`🖨️ [QZ TRAY PRINTER] Sending print job to target: ${config.ipAddress}`);
                
                // Connect to QZ Tray if not already connected
                if (!qz.websocket.isActive()) {
                    await qz.websocket.connect();
                }

                // If it's a raw IP address (e.g., 192.168.1.100), pass as { host, port }
                // Otherwise treat it as a locally installed USB printer name (string)
                const isIpPattern = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(config.ipAddress);
                const printerTarget = isIpPattern ? { host: config.ipAddress, port: '9100' } : config.ipAddress;

                const qzConfig = qz.configs.create(printerTarget);
                
                // Convert Uint8Array to base64 for QZ Tray
                const base64Data = btoa(String.fromCharCode.apply(null, Array.from(data)));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                const printData: any[] = [{
                    type: 'raw',
                    format: 'base64',
                    data: base64Data
                }];

                await qz.print(qzConfig, printData);
            } catch (error) {
                console.error('QZ Tray print failed:', error);
                throw new Error('Failed to print via QZ Tray. Make sure QZ Tray is running.');
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
     * Formats a POSOrder into a plain text string for receipt printing.
     */
    static formatOrderReceipt(order: POSOrder): string {
        const width = 48; // Standard 80mm thermal paper width
        const center = (str: string) => str.padStart(Math.floor((width + str.length) / 2)).padEnd(width);
        const rightAlign = (left: string, right: string) => {
            const spaces = width - left.length - right.length;
            return left + (spaces > 0 ? ' '.repeat(spaces) : ' ') + right;
        };

        const line = '-'.repeat(width) + '\n';
        let text = '\n';
        
        text += center('POINT OF SALE') + '\n';
        text += center('STORE LOCATION') + '\n\n';
        
        text += `Order:   ${order.orderNumber}\n`;
        text += `Date:    ${order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString() : new Date(order.createdAt as any).toLocaleString()}\n`;
        text += `Cashier: ${order.cashierName}\n`;
        if (order.tableName) {
            text += `Table:   ${order.tableName}\n`;
        }
        
        text += line;
        text += rightAlign('QTY  ITEM', 'TOTAL') + '\n';
        text += line;
        
        for (const item of order.items) {
            const qty = item.quantity.toString().padEnd(4);
            const totalStr = `P${item.subtotal.toFixed(2)}`;
            // Calculate remaining space for the item name
            const nameMaxWidth = width - qty.length - totalStr.length - 2; 
            let name = item.productName;
            if (name.length > nameMaxWidth) {
                name = name.substring(0, nameMaxWidth - 3) + '...';
            }
            name = name.padEnd(nameMaxWidth);
            text += `${qty} ${name} ${totalStr}\n`;
        }
        
        text += line;
        
        const formatMoney = (val: number) => `P${val.toFixed(2)}`;
        
        text += rightAlign('GROSS SUBTOTAL', formatMoney(order.subtotal + (order.discountAmount || 0))) + '\n';
        text += rightAlign('NET SUBTOTAL', formatMoney(order.subtotal)) + '\n';
        if (order.taxAmount) {
            text += rightAlign('VAT AMOUNT (12%)', formatMoney(order.taxAmount)) + '\n';
        }
        text += rightAlign('TOTAL', formatMoney(order.totalAmount)) + '\n';
        
        text += line;
        text += rightAlign('METHOD', order.paymentMethod) + '\n';
        if (order.amountTendered !== undefined) {
            text += rightAlign('TENDERED', formatMoney(order.amountTendered)) + '\n';
        }
        if (order.changeAmount !== undefined) {
            text += rightAlign('CHANGE', formatMoney(order.changeAmount)) + '\n';
        }
        
        text += '\n';
        text += center('THANK YOU FOR YOUR BUSINESS!') + '\n';
        text += '\n\n';
        return text;
    }

    /**
     * Formats a POSOrder into a plain text string for a running bill (pre-checkout) printing.
     */
    static formatRunningBill(order: Partial<POSOrder>): string {
        const width = 48; // Standard 80mm thermal paper width
        const center = (str: string) => str.padStart(Math.floor((width + str.length) / 2)).padEnd(width);
        const rightAlign = (left: string, right: string) => {
            const spaces = width - left.length - right.length;
            return left + (spaces > 0 ? ' '.repeat(spaces) : ' ') + right;
        };

        const line = '-'.repeat(width) + '\n';
        let text = '\n';
        
        text += center('POINT OF SALE') + '\n';
        text += center('STORE LOCATION') + '\n\n';
        
        text += center('*** RUNNING BILL ***') + '\n\n';

        if (order.orderNumber) {
            text += `Order:   ${order.orderNumber}\n`;
        }
        if (order.createdAt) {
            text += `Date:    ${(order.createdAt as any)?.toDate ? (order.createdAt as any).toDate().toLocaleString() : new Date(order.createdAt as any).toLocaleString()}\n`;
        } else {
            text += `Date:    ${new Date().toLocaleString()}\n`;
        }
        
        if (order.cashierName) {
            text += `Cashier: ${order.cashierName}\n`;
        }
        if (order.tableName) {
            text += `Table:   ${order.tableName}\n`;
        }
        
        text += line;
        text += rightAlign('QTY  ITEM', 'TOTAL') + '\n';
        text += line;
        
        if (order.items) {
            for (const item of order.items) {
                const qty = item.quantity.toString().padEnd(4);
                const totalStr = `P${item.subtotal.toFixed(2)}`;
                const nameMaxWidth = width - qty.length - totalStr.length - 2; 
                let name = item.productName;
                if (name.length > nameMaxWidth) {
                    name = name.substring(0, nameMaxWidth - 3) + '...';
                }
                name = name.padEnd(nameMaxWidth);
                text += `${qty} ${name} ${totalStr}\n`;
            }
        }
        
        text += line;
        
        const formatMoney = (val: number) => `P${val.toFixed(2)}`;
        
        if (order.subtotal !== undefined) {
            text += rightAlign('GROSS SUBTOTAL', formatMoney(order.subtotal + (order.discountAmount || 0))) + '\n';
            text += rightAlign('NET SUBTOTAL', formatMoney(order.subtotal)) + '\n';
        }
        
        if (order.taxAmount) {
            text += rightAlign('VAT AMOUNT (12%)', formatMoney(order.taxAmount)) + '\n';
        }
        
        if (order.totalAmount !== undefined) {
            text += rightAlign('TOTAL', formatMoney(order.totalAmount)) + '\n';
        }
        
        text += line;
        
        text += '\n';
        text += center('PLEASE PAY AT THE COUNTER') + '\n';
        text += '\n\n';
        return text;
    }

    /**
     * Generates a basic ESC/POS receipt payload.
     */
    static generateReceiptPayload(text: string): Uint8Array {
        const encoder = new TextEncoder();
        
        // Basic ESC/POS commands
        const ESC = 0x1B;
        const INIT = [ESC, 0x40]; // Initialize printer
        const ALIGN_LEFT = [ESC, 0x61, 0x00];
        const CUT_PAPER = [0x1D, 0x56, 0x41, 0x00]; // Cut paper command

        const data = [
            ...INIT,
            ...ALIGN_LEFT,
            ...Array.from(encoder.encode(text)),
            0x0A, 0x0A, 0x0A, // Feed 3 lines
            ...CUT_PAPER
        ];

        return new Uint8Array(data);
    }
}
