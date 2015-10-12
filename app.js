//Start with
//forever -o out.log -e err.log start -c "npm start" ~/bitpurge
var express = require('express.io');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var underscore = require('underscore');
var async = require('async');
var BTCE = require('btc-e');
var btcePublic = new BTCE();
var qrCode = require('qrcode');
var captcha = require('captcha');


//rpc setup
var rpc = require('node-json-rpc');

//artificial server time variable
var serverTime = 0;

//help keep track of blocks and when new ones come
var blockHeight = 0;

//
var txConfirmed = false;
var txPending = false;

//totalBalance
var totalBalance = 0;

//
var dirtyWallet = 'ADD YOUR OWN';
var cleanWallet = 'ADD YOUR OWN';

//Socket Pending and Confirmed Loop control variables
var DoNotTrackAddrs = [];
var allClients = [];
var allAddrs = [];

//helper loop var
var firstLoop = true;


var options = {
    // int port of rpc server, default 5080 for http or 5433 for https
    port: 20202,
    // string domain name or ip of rpc server, default '127.0.0.1' 
    host: '127.0.0.1',
    //user
    login: 'ADD YOUR OWN',
    //pass
    hash: 'ADD YOUR OWN',
    // string with default path, default '/'
    path: '/',
    // boolean false to turn rpc checks off, default true
    strict: false
};

// Create a server object with options
var client = new rpc.Client(options);

exports.getClient = function() {
    return client;
};

exports.getDb = function() {
    return db;
};

exports.getServerTime = function() {
    return serverTime;
};

exports.getCaptcha = function() {
    return captcha;
};

exports.getForwardAddr = function(incomingAddr) {
    
};


// New Code
var mongo = require('mongodb');
var monk = require('monk');
var db = monk('localhost:27017/mixerdb');

var routes = require('./routes/index');
var users = require('./routes/users');

var app = express();

app.http().io();

function moveToDirty(txid, vout, recvAddr, amount, callback) {
    console.log("moveToDirty createrawtransaction to -> dirtyWallet: " + dirtyWallet + "\n parseFloat(amount): " + parseFloat(amount));
    var rawArray = [];
    rawArray.push({
        "txid": txid,
        "vout": parseInt(vout)
    });
    console.log("rawArray: " + JSON.stringify(rawArray));



    client.call({
            "method": "createrawtransaction",
            "params": [rawArray, {
                'ADD YOUR OWN': parseFloat(amount) - 0.00002 //minus fee
            }]
        },
        function(errr, ress) {
            // Did it all work ?
            if (errr) {
                console.log("couldn't send coins to dirty wallet, possibly out? error: " + errr);
            } else if (ress == null) {
                console.log("response is null");
            } else {
                console.log("response from createrawtransaction: " + JSON.stringify(ress));
                var rawTx = ress.result;
                client.call({
                        "method": "signrawtransaction",
                        "params": [rawTx]
                    },
                    function(errrr, resss) {
                        // Did it all work ?
                        if (errrr) {
                            console.log("couldn't send coins to dirty wallet, possibly out? error: " + errrr);
                        } else if (resss == null) {
                            console.log("response is null");
                        } else {
                            console.log("response from signrawtransaction.result.hex: " + JSON.stringify(resss.result.hex));
                            var rawHex = resss.result.hex

                            client.call({
                                    "method": "sendrawtransaction",
                                    "params": [rawHex]
                                },
                                function(er, rs) {
                                    // Did it all work ?
                                    if (er) {
                                        console.log("couldn't send coins to dirty wallet, possibly out? error: " + er);
                                    } else if (rs == null) {
                                        console.log("response is null");
                                    } else {
                                        console.log("response from sendrawtransaction: " + JSON.stringify(rs));

                                    }
                                    callback();
                                }
                            );

                        }
                    }
                );
            }
        }
    );
}


// Setup the pending route, and emit confirmed event.
app.io.route('pending', function(req) {

    console.log("req is: " + req.data.message);
    var reqAddr = req.data.message;


    client.call({
            "method": "getreceivedbyaddress",
            "params": [reqAddr, 1]
        },
        function(errr, ress) {
            // Did it all work ?
            if (errr) {
                console.log("couldn't execute getreceivedbyaddress, error: " + errr);
            } else if (ress == null) {
                console.log("alert: response is null");
            } else {
                console.log("response from getreceivedbyaddress: " + JSON.stringify(ress));
                if (ress.result > 0) {
                    req.io.emit('talk', {
                        message: ress.result
                    });
                } else {
                    console.log("no confirmed transaction yet, looping...");
                    var timer = setInterval(function() {
                        if (allAddrs.indexOf(reqAddr.toString()) <= -1) {
                            console.log("checking for confirmed tx is HALTING... client disconnected");
                            clearTimeout(timer);
                        } else {

                            client.call({
                                    "method": "getreceivedbyaddress",
                                    "params": [reqAddr, 1]
                                },
                                function(errrr, resss) {
                                    // Did it all work ?
                                    if (errrr) {
                                        console.log("couldn't execute getreceivedbyaddress[3], error: " + errrr);
                                    } else if (resss == null) {
                                        console.log("alert: response is null");
                                    } else {
                                        console.log("response from getreceivedbyaddress: " + JSON.stringify(resss));
                                        if (resss.result > 0) {
                                            req.io.emit('confirmed', {
                                                message: 'yay transaction CONFIRMED!'
                                            });
                                            clearInterval(timer);
                                            console.log("interval cleared, loop ending");
                                        } else {
                                            console.log("no confirmed transactions yet, continuing loop");
                                        }

                                    }
                                }
                            );

                        }

                    }, 1000); //every 1000 milliseconds


                }

            }
        }
    );
})


app.io.sockets.on('connection', function(socket) {
    console.log('Got connect!' + socket.id);
    allClients.push(socket.id.toString());

    socket.on('disconnect', function() {
        console.log('Got disconnect!');

        var i = allClients.indexOf(socket.id);
        //console.log(allClients[i].toString() + " @@ " + allAddrs[i].toString());
        delete allClients[i];
        delete allAddrs[i];

    });
});


// Setup the ready route, and emit talk event.
app.io.route('ready', function(req) {
    allAddrs.push(req.data.message);
    console.log("req is: " + req.socket.id);
    var reqAddr = req.data.message;


    client.call({
            "method": "getreceivedbyaddress",
            "params": [reqAddr, 0]
        },
        function(errr, ress) {
            // Did it all work ?
            if (errr) {
                console.log("couldn't execute getreceivedbyaddress, error: " + errr);
            } else if (ress == null) {
                console.log("alert: response is null");
            } else {
                console.log("response from getreceivedbyaddress: " + JSON.stringify(ress));
                if (ress.result > 0) {
                    req.io.emit('talk', {
                        message: ress.result
                    });
                } else {
                    console.log("no pending transaction yet, looping...");
                    var timer = setInterval(function() {
                        if (allAddrs.indexOf(reqAddr.toString()) <= -1) {
                            console.log("checking for pending tx is HALTING... client disconnected");
                            clearTimeout(timer);
                        } else {
                            client.call({
                                    "method": "getreceivedbyaddress",
                                    "params": [reqAddr, 0]
                                },
                                function(errrr, resss) {
                                    // Did it all work ?
                                    if (errrr) {
                                        console.log("couldn't execute getreceivedbyaddress[2], error: " + errrr);
                                    } else if (resss == null) {
                                        console.log("alert: response is null");
                                    } else {
                                        console.log("response from getreceivedbyaddress: " + JSON.stringify(resss));
                                        if (resss.result > 0) {
                                            req.io.emit('talk', {
                                                message: resss.result
                                            });
                                            clearInterval(timer);
                                            console.log("interval cleared, loop ending");
                                        } else {
                                            console.log("no pending transaction yet, continuing loop");
                                        }

                                    }
                                }
                            );

                        }


                    }, 1000); //every 1000 milliseconds

                }

            }
        }
    );
})

//WORK ON ABOVE FUNCTION. qUERY THE CONFIRMED DB EVERY 5 SECONDS FOR THE BALANCE AND CONFIRMS

////////////////////////////////////////////////////

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(express.session({ secret: 'keyboardcat-btcpurge' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(captcha({ url: '/captcha.jpg', color:'#DADBDC', background: '#23467E' })); // captcha params

// Make our db accessible to our router
app.use(function(req, res, next) {
    req.db = db;
    next();
});

app.use('/', routes);
app.use('/users', users);


var nodeBalance = 0;
var lastBlock = "";
var balChange = 0; //records the change in balance
var latestrecaddr = "";
var latestrecamount = 0;
var txRecAddr = "";
var trxs = 0;
newBlockSetTx = false;



var latestBlockHash = "";

var txLength = 0;
var before = 0;



var txArray = [];
var latestTx = null;
var onlyTx = [];
var newTx = null;
var iaddrs = [];
var iamounts = [];
var i = 0;

//Start of Thread 1


function matchAndInsert(txid, addr, amt, callback) {
    console.log("match and insert is called");
    var collection = db.get('txs');
    // search the DB
    collection.findOne({
        "addr": addr.toString()
    }, {
        fields: { //not required used for debugging purposes
            _id: 0,
            token: 1,
            addr: 1,
            sendto: 1,
            splitAmount: 1,
            timeDelay: 1,
            feePercent: 1
        }
    }, function(err, doc) {
        if (err) {
            // If it failed, return error
            console.log("ERROR");
            res.send("There was a problem searching the information in the database.");
        } else {
            // If it worked...
            if (doc == null) {
                //if received a transaction without a match (FREE MONEY!!! :))
                console.log("yayy free money");
            } else if (doc.sendto == null) {
                //ifnoreturn
                console.log("doc is null:" + doc);
            } else { // here we found an entry and now will put it in the unconfirmed tx collection
                //first we get the necessary value to build our rawTx

                client.call({
                        "method": "gettransaction",
                        "params": [txid]
                    },
                    function(errr, ress) {
                        // Did it all work ?
                        if (errr) {
                            console.log("couldn't get transaction ? error: " + errr);
                        } else if (ress == null) {
                            console.log("COMMAND SUCCESS but response is null");
                        } else {
                            var details = ress.result.details
                            console.log("response from gettransaction var details[0].vout: " + JSON.stringify(details[0].vout));
                            collection = db.get('unconfirmed');
                            console.log("right before insertion");
                            //Adjust amount with fee
                            var floatFeePercent = parseFloat(doc.feePercent.toString()) * 0.0100;
                            var floatTotalAmount = parseFloat(amt.toString());
                            var floatTotalFee = floatFeePercent * floatTotalAmount;
                            var adjustedTotalAmount = floatTotalAmount - floatTotalFee;
                            var totalFixedamount = adjustedTotalAmount.toFixed(6);
                            // Submit to the DB
                            collection.insert({
                                "vout": details[0].vout.toString(),
                                "txid": txid.toString(),
                                "token": doc.token.toString(),
                                "recvAddr": doc.addr.toString(),
                                "sendto": doc.sendto.toString(),
                                "amount": totalFixedamount.toString(),
                                "timeDelay": doc.timeDelay.toString(),
                                "splitAmount": doc.splitAmount.toString()

                            }, function(err, doc) {
                                if (err) {
                                    // If it failed, return error
                                    res.send("There was a problem adding the information to the database.");
                                } else {
                                    // If it worked thread 1's job here is done
                                    console.log("Thread 1: submitted an entry to unconfirmed for rec addr: " + addr);


                                }
                                callback();

                            });
                        }

                    }
                );

            }

        }

    });
}




function getinfo(callback) {
    client.call({
            "method": "listtransactions",
            "params": ['*', 10]
        },
        function(err, res) {
            // Did it all work ?
            if (err) {
                //got empty response from transactions (none yet) fixed bug
                console.log("no transactions history or error:" + err);

            } else {
                var txArray = res.result;
                onlyTx = [];
                iaddrs = [];
                iamounts = [];
                for (x in txArray) { //creates tx only from the txArray
                    onlyTx.push(txArray[x].txid);
                    iaddrs.push(txArray[x].address);
                    iamounts.push(txArray[x].amount);
                }

                //console.log(txArray[txArray.length - 1].txid);
                if (latestTx == null) { //initialization for Tx
                    latestTx = onlyTx[onlyTx.length - 1]; //set it to last Tx
                    newTx = latestTx;
                }

                newTx = onlyTx[onlyTx.length - 1];
                if (newTx != latestTx) {
                    //do someshit with the new tx and set things straight
                    //find where it changed

                    var latestTxIndex = onlyTx.indexOf(latestTx);
                    var newTxSinceCheck = 9 - latestTxIndex;



                    console.log("new transactions since last checked: " + newTxSinceCheck);
                    //do the good stuff of matching each TX to a query in txs and putting the matched ones in confirm

                    //but but but... before we send off iaddr and iamount we need to splice it
                    iaddrs.splice(0, latestTxIndex + 1);
                    iamounts.splice(0, latestTxIndex + 1);
                    onlyTx.splice(0, latestTxIndex + 1);

                    console.log(iaddrs);
                    console.log(iamounts);
                    console.log("onlyTx: " + onlyTx);

                    if (parseFloat(iamounts) <= 0.0) {

                        console.log("nevermind, outgoing transactions. IGNORE");
                        latestTx = newTx;

                    } else {

                        var lg = 0;


                        async.whilst(
                            function() {
                                return lg < iaddrs.length;
                            },
                            function(next) {
                                matchAndInsert(onlyTx[lg], iaddrs[lg], iamounts[lg], function(result) {
                                    console.log("incrementing lg");
                                    lg++;
                                    next();
                                });
                            },
                            function(err) {
                                console.log("done!!!");
                                latestTx = newTx;
                            }
                        );
                    }

                }
            }
        }
    );
    setTimeout(function() {
        callback();
    }, 1000); //every 5 seconds
}



function series() {
    getinfo(function(result) {
        return series();
        //do some checks etc. etc.
    });
}




series(); //starts thread 1 which handles the receiving end


/// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

// Below is the start of thread 2 which handles sending transactions with time delays

//needed to generate random number (which is used for setting delayTime)

function randomInt(low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}

function delayInsert(snd, amt, iCounter, dInterval, sAmount, callback) {
    var collection = db.get('delay');
    var insertTime = (parseInt(iCounter) * parseInt(dInterval)) + serverTime + randomInt(10, 30); //algo for delayInsert modify as you please
    var amountToSend = parseFloat(amt) / parseFloat(sAmount); //splits the total payout (VERY IMPORTANT) incorrect = you loose money
    console.log("delayInsert serverTime " + serverTime);
    collection.insert({
        "sendto": snd,
        "amount": amountToSend,
        "time": insertTime
    }, function(err, doc) {
        if (err) {
            // If it failed, return error
            res.send("There was a problem adding the information to the database.");
            console.log("Thread 2: database error");
        } else {
            // If it worked thread 1's job here is done
            console.log("Thread 2: submitted an entry to delay with time: " + insertTime);



            //Thread 2's job here is done. It submitted 3 entries to delay now its time for thread 3 to send coins

        }
        callback();
    });

}

function startSenderLoop(callback) {
    //here we are checking the balance of the node 
    serverTime++;
    //console.log("Thread 2: is running, server time: " + serverTime);

    var collection = db.get('confirmed');
    collection.findOne({}, {
        fields: { //not required used for debugging purposes
            vout: 1,
            txid: 1,
            amount: 1,
            recvAddr: 1,
            sendto: 1,
            timeDelay: 1,
            splitAmount: 1,
            token: 1

        }
    }, function(e, docs) {
        if (e) {
            // If it failed, return error
            console.log("ERROR");
            res.send("There was a problem searching the information in the database.");
        } else {
            if (docs == null) {
                //console.log("Thread 2: nothing in the confirmed db");
            } else {


                client.call({
                        "method": "getbalance"
                    },
                    function(ers, rss) {


                        if (ers) {
                            console.log("couldnt get balance inside moveToDirty function ERROR: " + ers);
                        } else if (rss == null) {
                            console.log("response is null");
                        } else {
                            var reserveAmount = rss.result;
                            console.log("reserveAmount: " + reserveAmount);

                            if (parseFloat(reserveAmount) > 2 * parseFloat(docs.amount)) {
                                console.log("ENOUgh in RESERVE!!! Activating moveToDirty");
                                moveToDirty(docs.txid.toString(), docs.vout.toString(), dirtyWallet.toString(), docs.amount.toString(), function(result) {
                                    //finished moveToDirty
                                    console.log("finished moveToDirty, coins moved to dirty wallet");
                                });

                            }


                            //if there is something in the db perform some actions
                            //set the snd and amt
                            var snd = docs.sendto;
                            var amt = docs.amount.toString();
                            var vot = docs.vout;
                            var tid = docs.txid;
                            var tkn = docs.token
                            var timeDelay = docs.timeDelay;
                            var splitAmount = docs.splitAmount;

                            //now that the local variables are set delete the entry from confirmed
                            collection.remove({
                                "sendto": snd,
                                "amount": amt,
                                "vout": vot,
                                "txid": tid,
                                "token": tkn
                            }, function(ee, docss) {
                                console.log("Thread 2: removed " + docss + " entries successfully");
                                var time = serverTime;

                                var secTimeDelay = parseInt(timeDelay) * 60;
                                var delayInterval = parseInt(secTimeDelay) / parseInt(splitAmount);
                                var ic = 0;
                                console.log("splitAmount = " + splitAmount + " delayInterval = " + delayInterval);
                                async.whilst(
                                    function() {
                                        return ic < splitAmount;
                                    },
                                    function(next) {
                                        console.log("about to call delayInsert");
                                        delayInsert(snd, amt, ic, delayInterval, splitAmount, function(result) {
                                            console.log("incrementing ic");
                                            ic++;
                                            next();
                                        });
                                    },
                                    function(err) {
                                        console.log("done submitting to delay");

                                    }
                                );

                            });
                        }

                    });
            }
        }
    });



    setTimeout(function() {
        callback();
    }, 1000); //every 1000 milliseconds

}

function sender() {
    startSenderLoop(function(result) {
        return sender();
        //do some checks etc. etc.
    });
}

sender(); //just like series which starts thread 1, this starts thread 2

//This line marks the end of thread 2

//This line marks the beginning of thread 3


function sendAndDelete(sendtolocal, amountlocal, timelocal, callback) {

    client.call({
            "method": "sendtoaddress",
            "params": [sendtolocal, parseFloat(amountlocal) - 0.0001] //0.0001 is the "bug" fee to make sure wallet can't be emptied
        },
        function(errr, ress) {
            // Did it all work ?
            if (errr) {
                console.log("couldn't send coins, possibly out? error: " + errr);
            } else if (ress == null) {
                console.log("response is null");
            } else {
                console.log("response from sendtoaddress: " + JSON.stringify(ress));
                console.log("Thread 3: money sent to addr: " + sendtolocal + " amount: " + parseFloat(amountlocal));
                var collection = db.get('delay');
                console.log("sendtolocal, amountlocal, and ,time local: " + sendtolocal + " " + amountlocal + " " + timelocal);
                collection.remove({
                    "sendto": sendtolocal.toString(),
                    "amount": parseFloat(amountlocal),
                    "time": parseInt(timelocal)
                }, function(error, doc) {
                    console.log("removed executed, WriteResult: " + doc);
                    if (error) {
                        console.log("ERROR in removing delay entry");
                    } else if (doc == 0) {
                        //
                        console.log("soft error: didn't remove anything");
                    } else if (doc >= 1) {
                        //
                        console.log("done removing " + doc.nRemoved + "entry/entries");
                    }
                });

            }
            callback();
        }
    );

}


function finalSenderLoop(callback) {
    //here we are checking the balance of the node 

    //console.log("Thread 3: is running, server time: " + serverTime);

    var collection = db.get('delay');
    collection.find({
        "time": serverTime
    }, {}, function(e, docs) {
        if (e) {
            // If it failed, return error
            console.log("ERROR");
            res.send("There was a problem searching the information in the database.");
        } else {
            if (docs.length == 0) {
                //console.log("Thread 3: nothing in the delay db");
            } else {
                //if there is something in the db perform some actions
                console.log("LOGGIN length: " + docs.length + " first entry sendto: " + JSON.stringify(docs[0].sendto));
                console.log("Thread 3: found a matching entry!!!!!!!!!!!!!!!!!!!!!!!");
                var entries = 0;


                async.whilst(
                    function() {
                        return entries < docs.length;
                    },
                    function(next) {
                        sendAndDelete(docs[entries].sendto, docs[entries].amount, docs[entries].time, function(result) {
                            console.log("incrementing entries");
                            entries++;
                            next();
                        });
                    },
                    function(err) {
                        console.log("send and delete finished");
                        latestTx = newTx;

                    }
                );

            }
        }
    });

    setTimeout(function() {
        callback();
    }, 1000); //every 1000 milliseconds
}



function finalSender() {
    finalSenderLoop(function(result) {
        return finalSender();
        //do some checks etc. etc.
    });
}


finalSender(); //this is the entry point for thread 3

//this line marks the end of thread 3

//This starts thread 4: keeping track of btc price

function priceTrackerLoop(callback) {

    //here we are checking the price of btc, via btc-e 

    btcePublic.ticker("btc_usd", function(err, data) {

        if (data == null) {
            console.log("data is undefined trying again in next iteration");
        } else {
            console.log("BTC price: " + JSON.stringify(data.btc_usd.last));
            //updating global btcPrice variable
            var collection = db.get('btce');
            var curTimeMilliseconds = (new Date).getTime();
            var btcUsdPrice = parseFloat(data.btc_usd.last);
            if (firstLoop == true) {
                collection.insert({
                    status: "last",
                    btc_usd: btcUsdPrice
                }, function(err, doc) {
                    if (err) {
                        // If it failed, return error
                        res.send("There was a problem adding the information to the btce database.");
                    } else {
                        console.log("priceTrackerLoop worked! INSERTED btc_usd price into btce db");
                        firstLoop = false;
                    }
                });


            } else {
                collection.update({
                    "status": "last"
                }, {
                    btc_usd: btcUsdPrice,
                    status: "last"
                }, function(err, doc) {
                    if (err) {
                        // If it failed, return error
                        res.send("There was a problem adding the information to the btce database.");
                    } else {
                        console.log("priceTrackerLoop worked! UPDATED btc_sed price into btce db");
                        console.log("Server Time: " + serverTime);
                    }
                });
            }
        }
    });

    setTimeout(function() {
        callback();
    }, 5000); //every 5 seconds
}

function priceTracker() {
    priceTrackerLoop(function(result) {
        return priceTracker();
        //do some checks etc. etc.
    });
}

priceTracker(); //this is the entry point for thread 4 (the price tracker)

//This is the end of thread 4

//Start of longPurgeLoop

function longPurgeLoop(callback) {

    //here we are checking for any queries in unconfirmed that are longer than 24 hours 
    var collection = db.get('txs');
    var secondsUntilTerminate = 86400;
    if (serverTime - secondsUntilTerminate < 0) {
        console.log("longPurgeLoop running. Server time less than 86400");
    } else {
        collection.remove({
            "timeInserted": {
                $lt: serverTime - secondsUntilTerminate
            }
        }, function(error, doc) {
            console.log("removed executed, doc: " + doc);
            if (error) {
                console.log("ERROR in removing old unconfirmed entry");
            } else if (doc == 0) {
                //
                console.log("soft error: didn't remove anything");
            } else if (doc >= 1) {
                console.log("done removing " + doc.nRemoved + "entry/entries");
            }
        });
    }

    setTimeout(function() {
        callback();
    }, 60000); //every 60 seconds
}

function longPurge() {
    longPurgeLoop(function(result) {
        return longPurge();
        //do some checks etc. etc.
    });
}

longPurge(); //this is the entry point for thread 4 (the price tracker)

//end of longPurgeLoop


/*

At this point we have a collection called unconfirmed which has the unconfirmed transaction 
already incoming to the recv address. Now we must make another thread which will scan for new blocks,
every time a new block is found scan the unconfirmed database and move addresses with >1 confirmation
to the confirmed database.

*/

// Below is the start of thread 4 which handles confirming transactions


//pass in an unconfirmed transaction, will check that its confirmed and remove from unconfirmed db,
//then move tx to confirmed db to be sent out

function confirmAndRemove(uTxDoc, callback) {
    console.log("confirm and remove is called uTxDoc.token: " + uTxDoc.token);
    client.call({
        "method": "getbalance",
        "params": [uTxDoc.token.toString(), 1]
    }, function(err, doc) {
        if (err) {
            // If it failed, return error
            console.log("ERROR");
            res.send("There was a problem with the RPC call getbalance");
        } else {

            // If it worked...
            if (doc.result == null) {
                //if received an error, report
                console.log("error in confirmAndRemove: doc is null" + doc);
            } else if (doc.result == 0.0) {
                //ifnoreturn
                console.log("transaction is still unconfirmed, done, doc: " + JSON.stringify(doc));
            } else if (doc.result > 0.0) { // if tx is confirmed
                collection = db.get('unconfirmed');
                console.log("right before removal of confirmed tx in unconfirmed db");
                // Submit to the DB
                collection.remove({
                    "recvAddr": uTxDoc.recvAddr.toString(),
                    "token": uTxDoc.token.toString()
                }, function(err, doc) {
                    if (err) {
                        // If it failed, return error
                        res.send("There was a problem removing the information to the database.");
                    } else {
                        // If it worked entry has been deleted, now add all the info to the confirmed db.
                        console.log("Thread 1: submitting an entry to confirmed for rec addr: " + uTxDoc.recvAddr.toString());
                        collection = db.get('confirmed');
                        collection.insert({
                            "txid": uTxDoc.txid.toString(),
                            "vout": uTxDoc.vout.toString(),
                            "recvAddr": uTxDoc.recvAddr.toString(),
                            "token": uTxDoc.token.toString(),
                            "sendto": uTxDoc.sendto.toString(),
                            "amount": uTxDoc.amount.toString(),
                            "timeDelay": uTxDoc.timeDelay.toString(),
                            "splitAmount": uTxDoc.splitAmount.toString()
                        }, function(err, doc) {
                            if (err) {
                                // If it failed, return error
                                res.send("There was a problem adding the information to the database.");
                            } else {
                                // If it worked confirmAndRemove worked!
                                console.log("confirm and removed worked!");
                            }
                        });
                    }

                });

            }
        }

        callback();
    });

}

function startConfirmerLoop(callback) {
    //here we are checking the balance of the node 
    //console.log("Thread 1.5: is running, server time: " + serverTime);
    client.call({
            "method": "getblockcount",
            "params": []
        },
        function(err, res) {
            // Did it all work ?
            if (err) {
                //got empty response from transactions (none yet) fixed bug
                console.log("error with getblockcount RPC call:" + err);

            } else {
                var curBlockCount = res.result;
                if (blockHeight == 0) {
                    console.log("setting new blockheight");
                    blockHeight = curBlockCount;
                } else if (blockHeight < curBlockCount) {
                    console.log("@@@@@@@@@@@@ALERT: NEW Block Found!!! updating values and doing things");

                    /* When a new block is found we scan the unconfirmed database and check each 
                       transaction's confirmations. It they are >1 move them to the confirmed database */

                    var collection = db.get('unconfirmed');

                    collection.find({}, {
                        fields: {
                            recvAddr: 1,
                            txid: 1,
                            vout: 1,
                            token: 1,
                            sendto: 1,
                            amount: 1,
                            timeDelay: 1,
                            splitAmount: 1,
                            _id: 1
                        }

                    }, function(err, doc) {
                        if (err) {
                            // If it failed, return error
                            console.log("ERROR");
                            res.send("There was a problem searching the information in the database.");
                        } else {
                            // If it worked...
                            if (doc == null) {
                                console.log("doc is null");
                            } else if (doc.length == 0) {
                                //console.log("doc length is 0");
                            } else {
                                var jsonDoc = JSON.stringify(doc);
                                console.log("doc is not null and is of length:" + doc.length);

                                var lg = 0;


                                async.whilst(
                                    function() {
                                        return lg < doc.length;
                                    },
                                    function(next) {
                                        confirmAndRemove(doc[lg], function(result) {
                                            console.log("incrementing lg");
                                            lg++;
                                            next();
                                        });
                                    },
                                    function(err) {
                                        console.log("done!!! ");
                                    }
                                );

                            }

                        }
                    });

                    blockHeight = curBlockCount;
                } else {

                    //console.log("no new block, not doing anything");

                }
            }
        });


    setTimeout(function() {
        callback();
    }, 1000); //every 1000 milliseconds
}

function confirmer() {
    startConfirmerLoop(function(result) {
        return confirmer();
        //do some checks etc. etc.
    });
}

confirmer(); //just like series which starts thread 1, this starts thread 2

//This line marks the end of thread 4




module.exports = app;