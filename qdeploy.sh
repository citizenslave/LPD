if [[ $3 != "-n" ]]
    then
        $0 $1 $2 -n &
        exit $?
fi

sudo kill $(ps -ef | awk '$8 == "sudo" {print $2}')
node ./scripts/setup-db.js
sudo $NVM_BIN/node --max-old-space-size=8192 "./LPD AppServer.js" $1 $2 & 2> logs/error.log
