# OBD II server/client for Rapsberry PI

This Typescript / NodeJS software can be used to get internal information from a Hyundai Ioniq Electro (battery state, ...) using the OBD2 interface.  
For protocol details see [https://stackoverflow.com/questions/57306799](https://stackoverflow.com/questions/57306799).

This software uses **[Node.js/express Web-Server](https://expressjs.com/de/)** and **[Angluar Web Client](https://angular.io/)** on Raspberry PI.

You can work on project in different ways:

* **Development on localhost:**
    * Server running on [localhost:8080](localhost:8080)
    * Angular client running on [localhost:4200](localhost:4200)
    
    Start server with: *Lauch on notebook* (task *build*)  
    Start client with: `cd ngx; ng server`  
    
    **Attention:**
    When using **[service.server.ts](ngx-template/src/app/services/server.service.ts)**, make sure that `localhost` is used as server host!

* **Development with Raspberry PI:**
    * Server running on [pi-test:8080](pi-test:8080)
    * Angular client running on [localhost:4200](localhost:4200)
    
    Start server with: *Lauch on RPI* (task *buildAndLaunchOnRemote*)  
    Start client with: `cd ngx; ng server`  
    
    **Attention:**  
    Make sure that **[service.server.ts](ngx-template/src/app/services/server.service.ts)** is used with hostname of Raspberry Pi (`pi-test`)!


* **Development mode on Raspberry PI:**
    * Server running on [pi-test:8080](pi-test:8080)
    * Angular client running via server [pi-test:8080](pi-test:8080)
    
    Build Angular Project with: `ng build --prod` on localhost project.  
    Start server with: *Lauch on RPI* (task *buildAndLaunchOnRemote*)  
   
* **Production mode on Raspberry PI**
    * Server running on [pi-test:80](pi-test:80)
    * Angular client running via server [pi-test:80](pi-test:80)
    
    Build Angular Project with: `ng build --prod` on localhost project.  
    Transfer files to Raspberry PI (`CTRL+M` in VSCode, gulp task remote).  
    Change `server/config.js` on Raspberry PI and set port to 80  
    Start/Enable server on raspberry PI using `systemd` command `systemctl`.

-----------------------------------------------------

## Preparations

1) Install the needed software on both systems (localhost and Raspberry PI):

   * **Node.js** (see [Node.js/nodesource](https://github.com/nodesource/distributions#installation-instructions))
   
2) Install the needed software on your localhost system:

   * **Angular CLI** (see [Angular CLI Homepage](https://cli.angular.io/))  
     `sudo npm install -g @angular/cli` 
   * **Visual Studio Code** (see [Setting up VSCode](https://code.visualstudio.com/docs/setup/setup-overview))
   * Clone this git repository to your localhost

3) Edit [server/gulpfile.js](server/gulpfile.js) and set proper SSH connection incredentials:

```
    const remoteHostname = 'pi-test';
    const remoteTargetDir = '/home/pi/rpi-server-ngx';
    const sshConfig = {
        host: remoteHostname,
        port: 22,
        username: 'pi',
        privateKey: fs.readFileSync('/home/steiner/.ssh/id_rsa_rpi')
    }
```

4) Edit file [.vscode/launch.json](.vscode/launch.json) and set proper host name and project folder of Raspberry PI system:

```
    {
        "version": "0.2.0",
        "configurations": [
...        
    {
        "name": "Launch on RPI",
        "address": "pi-test",
        "remoteRoot": "/home/pi/rpi-server-ngx/server/",
        "smartStep": true,
        "stopOnEntry": false,
...
    {
        "name": "Build/Copy/Attach to RPI",
        "address": "pi-test",
        "remoteRoot": "/home/pi/rpi-server-ngx/server/",
        "smartStep": true,
        "stopOnEntry": false,           
...
    }            
```

5) Edit file [/etc/hosts](/etc/hosts) and set ip address or hostname for pi-test 

6) Edit file [~/.ssh/config](~/.ssh/config) and set connection config for ssh shell

```
  Host pi-test
      Hostname 10.200.114.201
      User pi
```
7) Create project directory on Raspberry PI

```bash
    cd <project>
    npm run remote-init
```

8) Create Angular project

```bash
     cd <project>
     npm run ngx-new
```
-----------------------------------------------------

## Build project

1) Build Angular project

```bash
    cd <project>
    cd ngx
    ng build --prod
    cd ..
```

2) Build server project

```bash
    cd <project>
    cd server
    npm install
    npm run build
    npm run remote
```
-----------------------------------------------------

## Run project

### Preparation

1) Install all node packages needed by the Node.js/express server

```bash
    ssh pi-test
    cd <project>/server
    npm install --prod
    exit
```

2) Create file server/config.json 

```bash
    ssh pi-test
    cd <project>/server
    nano config.json
    exit
```
Example for file *config.json* see [server/config.json](server/config.json)



### Start server on Raspberry PI

```bash
    ssh pi-test
    cd <project>
    npm start
```

-----------------------------------------------------

## Run server as system daemon

1) Create program folder on Raspberry /usr/share

```bash
    ssh pi-test
    sudo -i
    mkdir -p /usr/share/<project>/dist
    rsync -aP /home/pi/<project>/ /usr/share/<project>/dist/
    chown -R root:root /usr/share/<project>/
    exit
```

The dist folder is created to manage different versions.  
For example: 
```
    rsync -aP /home/pi/<project>/ /usr/share/<project>/dist_0.0.1/
    cd /usr/share/<project>
    ln -s dist_0.0.1 dist
```

2) Create systemd service file

```bash
    ssh pi-test
    sudo -i
    nano /etc/systemd/system/<project>.service
    cd /usr/share/<project>/
    ln -s /etc/systemd/system/<project>.service
    exit
```

Content of this service file for example:

```
[Unit]
Description=Node.js/express server 
After=syslog.target
After=network.target
After=local-fs.target

[Service]
#Type=oneshot
#RemainAfterExit=yes
Type=simple
ExecStart=/usr/bin/node /usr/share/<project>/dist/server/dist/main.js
ExecStop=/etc/init.d/nfs-common stop
WorkingDirectory=/tmp/
User=root
Group=root

[Install]
WantedBy=multi-user.target

```

3) Start system daemon and check journal

```bash
   ssh pi-test
   sudo -i 
   systemctl start <project>.service
   systemctl status <project>.service
   journalctl -f -u <project>.service
```

4) Enable automatic start of system daemon on system boot-up

```bash
   ssh pi-test
   sudo i
   systemctl enable <project>.service
```

5) Additonal commands...

```bash
   systemctl
   systemctl status
   systemctl restart <project>.service
   systemctl stop <project>.service
   systemctl disable <project>.service
```
