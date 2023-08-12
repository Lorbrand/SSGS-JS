# Sensor Seal Gateway Server
The Sensor Seal Gateway Server (SSGS) Node.js Module allows you to create a customized Sensor Seal Gateway Server that can perform customized processing of Sensor Seal measurements.

## Installing
Ensure you have Node.js version 14 or later installed and then follow the steps below:
1. Create a package
   ```
   npm init
   ```

3. Set the package type to "module"
   ```
   npm pkg set type="module"
   ```

5. Install SSGS
   ```
   npm i ssgs
   ```

## Basic Usage Example
Import the SSGS module and use it as follows:
```typescript
import SSGS from 'ssgs';

// Create a new Sensor Seal Gateway Server that listens on UDP port 1818
const server = new SSGS(1818, client => {
    // Called when a new client connects
    console.log('New client connected');

    // Print all updates received from the client
    client.onupdate = update => {
        console.log(`\nReceived Sensor Seal update via gateway ${SSGS.uidToString(update.viaGatewayUID)}:`);
        console.log(`Sensor Seal UID: ${SSGS.uidToString(update.sensorSealUID)}`);
        console.log(`Temperature: ${update.temperature} deg C`);
        console.log(`Vibration: ${update.vibration} mm/s^2`);
        console.log(`Speed: ${update.rpm} rpm`);
        console.log(`Voltage: ${update.voltage} mV`);
        console.log(`Update ID: ${update.updateID}`);
    };
});
```

## Port Forwarding
If you want gateways to be able to connect to your SSGS server from outside your local network, you need to forward external incoming traffic from UDP port 1818 (or the port the gateway was configured to connect to) to your SSGS server. It is recommended to keep all ports as 1818 unless you require multiple servers with the same public IP address.

## Setting Up Gateways
1. Connect the gateway to the internet via an ethernet cable. Power can be supplied to the gateway via Power over Ethernet (PoE) or the terminals.
2. Navigate to https://gateway.sensorseal.com and sign in to your Gateway Manager account.
3. Select the gateway you wish to configure.
4. Choose **SSGS** as the Connectivity Type
5. Enter the hostname of your SSGS server. This could be `ssgs.example.com` or `192.168.1.40` for example.
6. Enter the port of the SSGS server. This should be kept as 1818 unless you specifically changed the server's listening port.
7. Click **Generate Key** to generate a new key for this gateway.
8. Make note of the Gateway UID and key as these will be required later.
9. Click **Save Changes**.

## Configuring which gateways are allowed to connect
There are two ways in which gateways connecting to the server can be authorized or rejected:
1. An `authorized.json` file can be created in the root of the project directory. This file should contain a JSON object with a single property called `authorized_gateways` which is an array of objects with the following properties:
   - `description`: A description of the gateway. This is optional.
   - `uid`: The UID of the gateway as a string of hexadecimal bytes, optionally separated by spaces.
   - `key`: The key of the gateway as a string of hexadecimal bytes, optionally separated by spaces.
An example of this is shown below:
```json
{
    "authorized_gateways": [
        {
            "description": "This is an example gateway",
            "uid": "4d ec 5d fa",
            "key": "1a 02 d7 2e 8f f3 78 7f 31 19 e6 4d ec 5d fa 7b b3 42 a3 66 e5 18 28 df 97 ae ef a7 67 4d 62 aa"
        }
    ]
}
```
2. The `onconnectionattempt` callback can be set after creating the SSGS server. This callback is called when a gateway attempts to connect to the server and can be used to authorize or reject the connection. The callback is passed the gateway's UID, source address, and source port. It should return the key of the gateway if the connection is to be authorized, or `null` if the connection is to be rejected. For example:
```typescript
server.onconnectionattempt = async (gatewayUID, remoteAddress, port) => {

    // Check if the gateway is authorized and return the key if it is
    // These two functions must be implemented by you
    if (gatewayIsAuthorized(gatewayUID)) {
        return getGatewayKey(gatewayUID);
    }
    
    return null; 
};
```

## Starting the Server
Start the server with
```
node index.js
```
where `index.js` is the name of your project's entry point.

