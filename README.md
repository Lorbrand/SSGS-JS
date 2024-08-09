# Sensor Seal Gateway Server
The Sensor Seal Gateway Server (SSGS) Node.js Module allows you to create a customized Sensor Seal Gateway Server that can perform customized processing of Sensor Seal measurements.

## Protocols
- [x] SSGSCP: Supported
- [ ] WebSocket Secure (WSS): Future support planned

## Installing
Ensure you have Node.js (preferred) or Deno installed and then follow the steps below:
1. Navgate to a new folder and create a new package for your server
   ```
   npm init
   ```

3. Set the package type to "module"
   ```
   npm pkg set type="module"
   ```

5. Install Lorbrand SSGS
   ```
   npm i ssgs
   ```

## Basic Usage Example
Create an index.js or index.ts file, import the SSGS module, and use it as follows:
```typescript
import SSGS from 'ssgs';

// Create a new Sensor Seal Gateway Server that listens on UDP port 1818 (SSGSCP)
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

    // Called when a client disconnects
    client.ondisconnect = () => {
        console.log(`Client ${SSGS.uidToString(client.gatewayUID)} disconnected`);
    };
});
```

## Port Forwarding
If you want gateways to be able to connect to your server from outside your local network, you need to forward external inbound traffic from UDP port 1818 (or the port the gateway was configured to connect to) to your SSGS server using a NAT rule. It is recommended to keep all ports as 1818 unless you require multiple SSGS servers with the same public IP address.

## Setting Up Gateways
Please follow the instructions provided at https://www.sensorseal.com/docs/Configuring-Gateways/Software-Configuration/Getting-Started to configure gateways.

## Configuring which gateways are allowed to connect to your server
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
    // Using a database or similar, check if the gateway ID is authorized and return the corresponding PSK if it is
    // These two functions must be implemented by you
    if (await gatewayIsAuthorized(gatewayUID)) {
        return await getGatewayKey(gatewayUID);
    }
    
    return null; // Reject the connection
};
```

## Starting the Server
If using Node.js as a runtime, start the server with
```
node index.js
```
where `index.js` is the name of your server's entry point.

