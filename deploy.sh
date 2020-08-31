#sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 9DA31620334BD75D9DCB49F368818C72E52529D4
#echo "deb [ arch=amd64 ] https://repo.mongodb.org/apt/ubuntu bionic/mongodb-org/4.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.0.list
#sudo apt-get update
#sudo apt-get install -y mongodb-org git
#sudo service mongod start
echo --DOWNLOADING NVM--
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
cd
source ~/.profile
cd -
cd ~/.nvm
echo --UPDATE NVM--
git pull
cd -
echo --INSTALL NODE--
. ~/.nvm/nvm.sh
nvm install 13.8.0 --latest-npm
nvm use 13.8.0
echo --UPDATE APP--
git pull https://github.com/citizenslave/LPD.git
npm install
cd lpd-app
npm install
npm install -g @angular/cli
ng build --prod
cd ..
echo --KILL CURRENT PROCESSES--
sudo kill $(ps -ef | awk '$8 == "sudo" {print $2}')
echo --RESTART SERVERS--
$NVM_BIN/node ./scripts/setup-db.js
sudo $NVM_BIN/node --max-old-space-size=8192 "./LPD AppServer.js" $1 $2 &
