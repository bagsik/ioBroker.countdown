/**
 *
 *      ioBroker COUNTDOWN Adapter
 *
 *      (c) 2019 Alexander K <blacksonj7@gmail.com>
 *
 *      MIT License
 *
 */

'use strict';
const translateJS = require('./translate.js');                                                      // translate
const a = new translateJS();

const utils = require('@iobroker/adapter-core');
const moment = require('moment');
const tableify = require(`tableify`);
var AdapterStarted;
var Interval
var translateObject = {}
var tableArray
var storagename = ''


let objects = null;

let adapter;

function startAdapter(options) {

    options = options || {};
    Object.assign(options, {
        name: 'countdown',
        ready: function() {
            Interval = setInterval(function() { 
                // alle 1 Minute ausführen 
                main(); 
            }, 60000); 
            main()
        }
    });

    AdapterStarted = false;

    adapter = new utils.Adapter(options);

    //adapter.log.debug('Starting Adapter')

    adapter.on('message', async obj => {
        //adapter.log.debug('received message!');
    
        if (obj && obj.command === 'send') {
            adapter.log.debug('M 0.1 received send command!');
            let processed = await processMessage(obj);
            let setup = await processCountdowns()
            adapter.log.debug('M 3: All Done');

        }
        
    });
    
    adapter.on(`unload`, callback => {
        adapter.log.debug(`5. Stopping countdown adapter!`);
        clearInterval(Interval);
        callback && callback();
        //callback();
    });


    return adapter;

}



function main() {
    
    adapter.log.debug('0 Main')
    processCountdowns()

}



async function processCountdowns(){
    if (AdapterStarted == false){
        
        let done2 = await getVariableTranslation()
        adapter.log.debug('0.2 delete countdowns for a clean start')
        let cleanedAtAtart = await deleteAllCountdowns()
        AdapterStarted = true
    }

    


    adapter.log.debug('1 Loop setup')

    let loop = await loopsetup()
    adapter.log.debug('1.9 after loop setup')

    adapter.log.debug('2 Clean Results')
    let cleaned = await cleanresults()

    adapter.log.debug('3 Update HTML and JSON table')
    let updated = await updateCountdownTable()
    adapter.log.debug('3.2 Updated HTML and JSON table')


    adapter.log.debug('4. Done')
    //adapter.terminate ? adapter.terminate('5. Stopping adapter') : process.exit(0);


}

async function deleteAllCountdowns(){
    const promises = await Promise.all([

        adapter.deleteDeviceAsync('countdowns')
        //adapter.deleteChannelAsync('tomorrow'),
        //adapter.deleteStateAsync('weatherMapCountry')

    ])

}


async function cleanresults(CountName){
    adapter.log.debug('2.1 Starting cleaning countdowns in setup')
    return new Promise(function(resolve){




        // clean results when a setup is deleted
        if(CountName == null){
            // function started without parameter from normal loop
            adapter.getChannelsOf('countdowns', function (err, result) {
                for (const channel of result) {
                    //adapter.log.debug('2.2 checking countdown "' + channel.common.name)
                    adapter.getObject('setup.' + channel.common.name, async function (err, state) {
                        //check if setup is still existing
                        if(state === null && typeof state === "object") {
                            //if not - delete results
                            let done = await deleteCountdownResults(channel.common.name)
                        }
                    });   
                }
            });
            adapter.log.debug('2.2 Cleaned results')
            resolve('done')

        }
        else{
            // function started with parameter Name - not necessary yet
            resolve('done')


        }
    })

}

async function deleteCountdownResults(CountName){
    const promises = await Promise.all([
        adapter.deleteChannel('countdowns',CountName)
    ])
    adapter.log.debug('Deleted details for countdown ' + CountName)
}

function deleteCountdownSetup(CountName){
    adapter.deleteState('setup','',CountName);
    adapter.log.debug('Deleted setup for countdown ' + CountName)

}


async function loopsetup(){
    adapter.log.debug('1.1 Start Loop Setup')

    tableArray = [];

    return new Promise(function(resolve){
        adapter.getStatesOf("setup", async function(error, result) {
            for (const id1 of result) {
                adapter.log.debug('1.2 Setup Entries found: ' + id1.common.name )
                let states = await getStatesOfObj(id1.common.name)

                
            }
            resolve('done')
        });

    })
}

async function getStatesOfObj(name){
    return new Promise(function(resolve){

        adapter.getState('setup.' + name, async function (err, state) {
            //prüfen ob Device schon vorhanden ist
            let check = await checkifCountdownExists(name, state)
            resolve('done')
        });
        

    })
}

async function checkifCountdownExists(name, state){
    return new Promise(function(resolve){
        adapter.log.debug('1.3 check if countdown ' + name + ' exists')
        adapter.getObject('countdowns.' + name + '.name', async function (err1, result1) {
    
            if(result1 === null && typeof result1 === "object") {
    
                const CountName = name
                const done = await createObjects(CountName)
                adapter.getState('setup.' + CountName, async function (err, state) {    
                    if (state && state.val){
                        let done = await createCountdownData(name,state.val)
                        adapter.log.debug(' 1.6-1 Created Countdown ' + CountName);
                        resolve('done')

                    }
                    else{
                        const CountName = name
                        adapter.log.error('Date in setup is invalid for countdown ' + CountName)
                        resolve('done')

                    }
                   });

            }
            else{
    
                if (state && state.val){
                    let done1 = await createCountdownData(name,state.val)
                    adapter.log.debug(' 1.6-2 Updated Countdown ' + name);
                    resolve('done')

    
                }
                else{
                    const CountName = name
                    adapter.log.error('Date in setup is invalid for countdown ' + CountName)
                    resolve('done')

                }
            }

        });
    })
    
    
}

function getVariableTranslation(){
    var language = ''
    return new Promise(function(resolve){

        adapter.getForeignObject('system.config', (err, systemConfig) => {
            language = systemConfig.common.language
            translateObject = a.transLate(language)
            adapter.log.debug('0.1 Received translations')
            resolve('done')

        });
    })
}


async function createCountdownData(CountName, CountDate){
    adapter.log.debug('1.4 Updating countdown objects for countdown ' + CountName)
    return new Promise(async function(resolve){

        var repeatCycle = ''
        // check if a "repeat cycle" was added
        let SearchForCycle = CountDate.indexOf('+')
        if (SearchForCycle != -1){
            repeatCycle = CountDate.slice((SearchForCycle+1), CountDate.length)
            CountDate = CountDate.slice(0,SearchForCycle)
        }
        //adapter.log.debug('Repeat Cycle for ' + CountName + ' is: ' +  repeatCycle)
    
        var countUp = false
        // check if a "countup" was added
        SearchForCycle = CountDate.indexOf('#')
        if (SearchForCycle != -1){
            countUp = true
            //CountDate = CountDate.slice(0,SearchForCycle)
            adapter.log.debug('1.4.1: CountUp active for ' + CountName )
        }



        var newdate = moment(CountDate, 'DD.MM.YYYY HH:mm:ss').toDate();
    
        switch (adapter.config.dateFormat) {
            case "EuropeDot": var newdatelocal = moment(newdate).local().format('DD.MM.YYYY HH:mm');
                            break;
            case "EuropeMinus": var newdatelocal = moment(newdate).local().format('DD-MM-YYYY HH:mm');
                                break;
            case "USDot"  : var newdatelocal = moment(newdate).local().format('MM.DD.YYYY HH:MM');
                            break;
            case "USMinuts"   : var newdatelocal = moment(newdate).local().format('MM-DD-YYYY HH:MM');
                            break;
            case "YearFirst"   : var newdatelocal = moment(newdate).local().format('YYYY-MM-DD HH:mm');
                            break;
            default: var newdatelocal = moment(newdate).local().format('DD.MM.YYYY HH:mm');
        } 

        var now = moment(new Date()); //todays date
        var years
        var restDate
        var months
        var days
        var hours
        var minutes

        if (!countUp){
            // normal countdown
            years = now.diff(newdate, 'years', false) * -1;
            restDate = moment(newdate).subtract(years, 'year')
            months = now.diff(restDate, 'months', false) * -1;
            restDate = moment(restDate).subtract(months, 'month')
    
            days = now.diff(restDate, 'days', false) * -1;
            restDate = moment(restDate).subtract(days, 'days')
            hours = now.diff(restDate, 'hours', false) * -1;
            restDate = moment(restDate).subtract(hours, 'hours')
            minutes = now.diff(restDate, 'minutes', false) * -1;
        }
        else{
            //Count Up
            var tempNow = moment(now, 'DD.MM.YYYY HH:mm:ss').toDate();
            var upDate = moment(newdate)
            years = upDate.diff(tempNow, 'years', false) * -1;
            restDate = moment(tempNow).subtract(years, 'year')
            months = upDate.diff(restDate, 'months', false) * -1;
            restDate = moment(restDate).subtract(months, 'month')
    
            days = upDate.diff(restDate, 'days', false) * -1;
            restDate = moment(restDate).subtract(days, 'days')
            hours = upDate.diff(restDate, 'hours', false) * -1;
            restDate = moment(restDate).subtract(hours, 'hours')
            minutes = upDate.diff(restDate, 'minutes', false) * -1;
        }
    

    
        storagename = CountName
        adapter.setState({device: 'countdowns' , channel: storagename, state: 'name'}, {val: CountName, ack: true});
        adapter.setState({device: 'countdowns' , channel: storagename, state: 'endDate'}, {val: newdatelocal, ack: true});
    
        if ((now.diff(newdate) >= 0) && !countUp){
            adapter.log.debug('1.4.2 Countdown in the past - ' + CountName)

            if (repeatCycle != ''){
                // calculate new end date and write it into setup - countdown will then be updated in the next update cycle
    
                // check if repeat cycle contains a number
    
                if (hasNumber(repeatCycle)){
                    var repeatNumber = Number(repeatCycle.match(/\d+/g).map(Number))
                    if (repeatNumber != null){
                        var repeatType = repeatCycle.slice(repeatNumber.toString().length, repeatCycle.length);
                        if (repeatType != '') {
                            var newDateRepeat = newdate
    
                            switch (repeatType) {
                                case "Y": 
                                                newDateRepeat = new Date(newdate.getFullYear() + repeatNumber, newdate.getMonth(), newdate.getDate(), newdate.getHours(), newdate.getMinutes())
                                                break;
                                case "M": 
                                                newDateRepeat = new Date(newdate.getFullYear(), newdate.getMonth() + repeatNumber, newdate.getDate(), newdate.getHours(), newdate.getMinutes())
                                                break;
                                case "D"  : 
                                                newDateRepeat = new Date(newdate.getFullYear(), newdate.getMonth(), newdate.getDate()+ repeatNumber, newdate.getHours(), newdate.getMinutes())
                                                break;
                                case "H"   : 
                                                newDateRepeat = new Date(newdate.getFullYear(), newdate.getMonth(), newdate.getDate(), newdate.getHours()+ repeatNumber, newdate.getMinutes())
                                                break;
                                case "m"   : 
                                                newDateRepeat = new Date(newdate.getFullYear(), newdate.getMonth(), newdate.getDate(), newdate.getHours(), newdate.getMinutes()+ repeatNumber)
                                                break;
                                default: adapter.log.error('Repeat Cycle ' + repeatCycle + ' is invalid!')
                                ;
                            }
                            let newDateString = moment(newDateRepeat).format('DD') + '.' + moment(newDateRepeat).format('MM') + '.' + 
                            moment(newDateRepeat).format('YYYY') + ' ' + moment(newDateRepeat).format('HH') + ':' + 
                            moment(newDateRepeat).format('mm') + ':00' + '+' + repeatCycle
                            adapter.setState({device: 'setup' , state: storagename}, {val: newDateString, ack: true});
    
                        }
                        else{
                            adapter.log.error('Repeat Cycle ' + repeatCycle + ' is invalid!')
                        }   
                    }
                    else{
                        adapter.log.error('Repeat Cycle ' + repeatCycle + ' is invalid!')
                    }
                }
                else{
                adapter.log.error("Repeat cycle " + repeatCycle + " is invalid - Layout is e.g. 1M for 1 month.")
                }
            }
            else{
                // Countdown reached now -> disable countdown 
                adapter.setState({device: 'countdowns' , channel: storagename, state: 'years'}, {val: 0, ack: true});
                adapter.setState({device: 'countdowns' , channel: storagename, state: 'months'}, {val: 0, ack: true});
                adapter.setState({device: 'countdowns' , channel: storagename, state: 'days'}, {val: 0, ack: true});
                adapter.setState({device: 'countdowns' , channel: storagename, state: 'hours'}, {val: 0, ack: true});
                adapter.setState({device: 'countdowns' , channel: storagename, state: 'minutes'}, {val: 0, ack: true});
                adapter.setState({device: 'countdowns' , channel: storagename, state: 'inWordsShort'}, {val: '', ack: true});
                adapter.setState({device: 'countdowns' , channel: storagename, state: 'inWordsLong'}, {val: '', ack: true});
                adapter.setState({device: 'countdowns' , channel: storagename, state: 'reached'}, {val: true, ack: true});
                adapter.setState({device: 'countdowns' , channel: storagename, state: 'repeatEvery'}, {val: '', ack: true});
                adapter.setState({device: 'countdowns' , channel: storagename, state: 'totalHours'}, {val: 0, ack: true});
                adapter.setState({device: 'countdowns' , channel: storagename, state: 'totalDays'}, {val: 0, ack: true});
                adapter.setState({device: 'countdowns' , channel: storagename, state: 'totalWeeks'}, {val: 0, ack: true});
                adapter.setState({device: 'countdowns' , channel: storagename, state: 'totalMonths'}, {val: 0, ack: true});
                adapter.setState({device: 'countdowns' , channel: storagename, state: 'totalYears'}, {val: 0, ack: true});
                adapter.setState({device: 'countdowns' , channel: storagename, state: 'json'}, {val: '', ack: true});


    
                if (adapter.config.autodelete){
                    let deleted = await deleteCountdownSetup(CountName)
                    let deleted1 = await deleteCountdownResults(CountName)
                }
            }
            resolve('done')

        }
        else{
            // Countdown not reached -> update values
            adapter.log.debug('1.4.3 Countdown in the future - ' + CountName)


            var CountDowninWordsShort = '';
            var CountDowninWordsLong = '';
    
            //years
            if (years != 0){
                if (years > 1){
                    CountDowninWordsLong = years+' ' +  translateObject.textYears;
                    CountDowninWordsShort = years+ translateObject.textYearsShort;
                }
                else if (years == 1){
                    CountDowninWordsLong = years+' ' +  translateObject.textYear;
                    CountDowninWordsShort = years+ translateObject.textYearsShort;
                }
            }
    
            //months
            if (months != 0 || years != 0){
    
                if (months > 1){
                    CountDowninWordsLong += ' ' + months+ ' ' + translateObject.textMonths;
                    CountDowninWordsShort += ' ' + months+translateObject.textMonthsShort;
                }
                else if (months == 1) {
                    CountDowninWordsLong += ' ' + months+ ' ' + translateObject.textMonth;
                    CountDowninWordsShort += ' ' + months+translateObject.textMonthsShort;
                }
            }
    
            //days
            if (days != 0 || months != 0 || years != 0){
    
                if (days > 1){
                    CountDowninWordsLong += ' ' + days+ ' ' + translateObject.textDays;
                    CountDowninWordsShort += ' ' + days+translateObject.textDaysShort;
                }
                else if (days == 1) {
                    CountDowninWordsLong += ' ' + days+ ' ' + translateObject.textDay;
                    CountDowninWordsShort += ' ' + days+translateObject.textDaysShort;
                }
            }
    
            //hours
            if (hours != 0 && years == 0 && months == 0 && days == 0){
                if (hours > 1){
                    CountDowninWordsLong += ' ' + hours+ ' ' + translateObject.textHours;
                    CountDowninWordsShort += ' ' + hours+translateObject.textHoursShort;
                }
                else if (hours == 1){
                    CountDowninWordsLong += ' ' + hours+' ' + translateObject.textHour;
                    CountDowninWordsShort += ' ' + hours+translateObject.textHoursShort;
                } 
            }
    
            //minutes
            if (minutes != 0 && years == 0 && months == 0 && days == 0){
                CountDowninWordsShort += ' ' + minutes+translateObject.textMinutesShort;
                if (minutes > 1){
                    CountDowninWordsLong += ' ' + minutes+ ' ' + translateObject.textMinutes;
                }
                else {
                    CountDowninWordsLong += ' ' + minutes+' ' + translateObject.textMinute;
                }     
            }
    
            //adapter.log.debug('vor speichern1: ' + months)  

            var totalDays
            var totalHours
            var totalWeeks
            var totalMonths
            var totalYears
            

            if (!countUp){
                // Normal Countdown
                totalDays = mydiff(Date(),newdate,"days");
                totalHours = mydiff(Date(),newdate,"hours");
                totalWeeks = mydiff(Date(),newdate,"weeks");
                totalMonths = mydiff(Date(),newdate,"months");
                totalYears = mydiff(Date(),newdate,"years");
            }
            else{
                // CountUp
                totalDays = mydiff(newdate,Date(),"days");
                totalHours = mydiff(newdate,Date(),"hours");
                totalWeeks = mydiff(newdate,Date(),"weeks");
                totalMonths = mydiff(newdate,Date(),"months");
                totalYears = mydiff(newdate,Date(),"years");
            }

    
    
            let done = await updateObjects(years,months,days,hours,minutes,CountDowninWordsShort,CountDowninWordsLong,totalDays,totalHours,totalWeeks,totalMonths, totalYears,repeatCycle,countUp)
    
            adapter.log.debug('1.5 Updated objects for ' + CountName)
    
            
    
            var tableObject = {}
    
            tableObject[translateObject.headerName] = CountName
            
    
            if (adapter.config.inWordsShort){
                tableObject[translateObject.headerCountdown] = CountDowninWordsShort
            }
    
            if (adapter.config.inWordsLong){
                tableObject[translateObject.headerCountdown + ' '] = CountDowninWordsLong
            }
    
            if (adapter.config.totalNoOfDays){
                tableObject[translateObject.textDays] = totalDays
            }
    
            if (adapter.config.totalNoOfHours){
                tableObject[translateObject.textHours] = totalHours
            }
    
            if (adapter.config.totalNoOfWeeks){
                tableObject[translateObject.textWeeks] = totalWeeks
            }
    
            if (adapter.config.endDate){
                tableObject[translateObject.headerEndDate] = newdatelocal
            }
    
            tableArray.push(tableObject);
            adapter.log.debug('1.5.1 Added data for countdown ' + CountName + ' to array')
            resolve('done')
    
        }
    })

}

async function updateObjects(years,months,days,hours,minutes,CountDowninWordsShort,CountDowninWordsLong,totalDays,totalHours,totalWeeks,totalMonths, totalYears, repeatCycle,countUp){
    let fullJson = {
        'years': years,
        'months': months,
        'days': days,
        'hours': hours,
        'minutes': minutes,
        'inWords': {
            'short': CountDowninWordsShort,
            'long': CountDowninWordsLong
        },
        'total': {
            'days': totalDays,
            'hours': totalHours,
            'weeks': totalWeeks,
            'months': totalMonths,
            'years': totalYears
        },
        'repeatCycle': repeatCycle,
        'countUp': countUp
    }
    
    const promises = await Promise.all([
        adapter.setState({device: 'countdowns' , channel: storagename, state: 'years'}, {val: years, ack: true}),
        adapter.setState({device: 'countdowns' , channel: storagename, state: 'months'}, {val: months, ack: true}),
        adapter.setState({device: 'countdowns' , channel: storagename, state: 'days'}, {val: days, ack: true}),
        adapter.setState({device: 'countdowns' , channel: storagename, state: 'hours'}, {val: hours, ack: true}),
        adapter.setState({device: 'countdowns' , channel: storagename, state: 'minutes'}, {val: minutes, ack: true}),
        adapter.setState({device: 'countdowns' , channel: storagename, state: 'inWordsShort'}, {val: CountDowninWordsShort, ack: true}),
        adapter.setState({device: 'countdowns' , channel: storagename, state: 'inWordsLong'}, {val: CountDowninWordsLong, ack: true}),
        adapter.setState({device: 'countdowns' , channel: storagename, state: 'reached'}, {val: false, ack: true}),
        adapter.setState({device: 'countdowns' , channel: storagename, state: 'totalDays'}, {val: totalDays, ack: true}),
        adapter.setState({device: 'countdowns' , channel: storagename, state: 'totalHours'}, {val: totalHours, ack: true}),   
        adapter.setState({device: 'countdowns' , channel: storagename, state: 'totalWeeks'}, {val: totalWeeks, ack: true}), 
        adapter.setState({device: 'countdowns' , channel: storagename, state: 'totalMonths'}, {val: totalMonths, ack: true}),   
        adapter.setState({device: 'countdowns' , channel: storagename, state: 'totalYears'}, {val: totalYears, ack: true}),
        adapter.setState({device: 'countdowns' , channel: storagename, state: 'repeatEvery'}, {val: repeatCycle, ack: true}),  
        adapter.setState({device: 'countdowns' , channel: storagename, state: 'countUp'}, {val: countUp, ack: true}),
        adapter.setState({device: 'countdowns' , channel: storagename, state: 'json'}, {val: fullJson, ack: true})
    ])
}

function hasNumber(myString) {
    // function to check if string contains a number
    return /\d/.test(myString);
  }
  

async function processMessage(obj){
    adapter.log.debug('M 1: Start processing Message')
    return new Promise(async function(resolve){
        var year = 0
        var month = '0'
        var day = '0'
        var hour = '01'
        var minute = '01'
        var name = obj.message.name
        var erroroccured = false
    
        if (typeof obj.message.date != 'undefined'){
            var repeatCycle = ''
            adapter.log.debug('M 1.1: object message: ' + obj.message.date)
            if (obj.message.date != ''){ 
                var processingDate = obj.message.date
                // check if a "repeat cycle" was added
                let SearchForCycle = obj.message.date.indexOf('+')
                if (SearchForCycle != -1){
                    repeatCycle = obj.message.date.slice((SearchForCycle), obj.message.date.length)
                    processingDate = processingDate.slice(0,SearchForCycle)
                }

                SearchForCycle = obj.message.date.indexOf('#')
                let countUp = false
                if (SearchForCycle != -1){
                    countUp = true
                    processingDate = processingDate.slice(0,SearchForCycle)
                }
    
                //adapter.log.debug('TEMP processingDate: ' + processingDate)
                //adapter.log.debug('setup: ' + adapter.config.dateFormat)
    
                var messageDate = new Date
                switch (adapter.config.dateFormat) {
                    case "EuropeDot": 
                                    messageDate = moment(processingDate, 'DD.MM.YYYY HH:mm').toDate();
                                    break;
                    case "EuropeMinus": 
                                     messageDate = moment(processingDate, 'DD-MM-YYYY HH:mm').toDate();
                                    break;
                    case "USDot"  : 
                                    messageDate = moment(processingDate, 'MM.DD.YYYY HH:MM').toDate();
                                    break;
                    case "USMinuts"   : 
                                    messageDate = moment(processingDate, 'MM-DD-YYYY HH:MM').toDate();
                                    break;
                    case "YearFirst"   : 
                                    messageDate = moment(processingDate, 'YYYY-MM-DD HH:mm').toDate();
                                    break;
                    default: messageDate = moment(processingDate, 'DD.MM.YYYY HH:mm').toDate();
                    ;
                }
    
                var messageDateString = moment(messageDate).format('DD') + '.' + moment(messageDate).format('MM') + '.' + 
                                        moment(messageDate).format('YYYY') + ' ' + moment(messageDate).format('HH') + ':' + 
                                        moment(messageDate).format('mm') + ':00'
                 
                //adapter.log.debug(' messageDateString: ' + messageDateString)
                //adapter.log.debug(' messageDate: ' + messageDate)
    
                //adapter.log.debug('CHECK IF VALID)')
                if (moment(messageDateString, 'DD.MM.YYYY HH:mm:ss',true).isValid()) {
                    //adapter.log.debug('VALID)')
    
                    messageDateString += repeatCycle
                    if (countUp){
                        messageDateString += '#'
                    }
                    const done = await createSetupEntryCompleteDate(messageDateString,name);
                    //const done1 = await loopsetup();
    
                }
                else{
                    // invalid date
                    //adapter.log.debug('INVALID date: '+  moment(messageDateString, 'DD.MM.YYYY HH:mm:ss',true))
    
                    adapter.log.error('M 1.2: Date for countdown ' + name + ' is invalid: ' + obj.message.date)
                }
            }
        }    
        
        else if (typeof obj.message.addminutes != 'undefined'){
            if (obj.message.addminutes != '' && obj.message.addminutes != '0' && parseInt(obj.message.addminutes)){             
                var now = new Date(); //todays date
                var toAdd = Number(obj.message.addminutes)
                var newDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes()+ toAdd)
                var messageDateString = moment(newDate).format('DD') + '.' + moment(newDate).format('MM') + '.' + 
                                            moment(newDate).format('YYYY') + ' ' + moment(newDate).format('HH') + ':' + 
                                            moment(newDate).format('mm') + ':00' 
        
                const done = await createSetupEntryCompleteDate(messageDateString,name);
                //const loop = await loopsetup();
            
                }
            else{
                    adapter.log.error('M 1.3: '+ name + ': Adding ' + obj.message.addminutes + ' is invalid')
            }
        }
        else if (typeof obj.message.addhours != 'undefined'){
            if (obj.message.addhours != '' && obj.message.addhours != '0' && parseInt(obj.message.addhours)){            
                 
                var now = new Date(); //todays date
                var toAdd = Number(obj.message.addhours)
                var newDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()+ toAdd, now.getMinutes())
                var messageDateString = moment(newDate).format('DD') + '.' + moment(newDate).format('MM') + '.' + 
                                            moment(newDate).format('YYYY') + ' ' + moment(newDate).format('HH') + ':' + 
                                            moment(newDate).format('mm') + ':00' 
        
                const done = await createSetupEntryCompleteDate(messageDateString,name);
                //const loop = await loopsetup();
                
            }
            else{
                adapter.log.error('M 1.3: ' + name + ': Adding ' + obj.message.addhours + ' is invalid')
            }
        }
        else if (typeof obj.message.adddays != 'undefined'){
            if (obj.message.adddays != '' && obj.message.adddays != '0' && parseInt(obj.message.adddays)){            
                var now = new Date(); //todays date
                var toAdd = Number(obj.message.adddays)
                var newDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + toAdd, now.getHours(), now.getMinutes())
        
                var messageDateString = moment(newDate).format('DD') + '.' + moment(newDate).format('MM') + '.' + 
                                            moment(newDate).format('YYYY') + ' ' + moment(newDate).format('HH') + ':' + 
                                            moment(newDate).format('mm') + ':00' 
        
                const done = await createSetupEntryCompleteDate(messageDateString,name);
                //const loop = await loopsetup();                      
        
            }
            
            else{
                adapter.log.error('M 1.3: ' + name + ': Adding ' + obj.message.adddays + ' is invalid')
            }
        }
        else if (typeof obj.message.addmonths != 'undefined'){
            if (obj.message.addmonths != ''&& obj.message.addmonths != '0' && parseInt(obj.message.addmonths)){            
                var now = new Date(); //todays date
                var toAdd = Number(obj.message.addmonths)
    
                var newDate = new Date(now.getFullYear(), now.getMonth() + toAdd, now.getDate(), now.getHours(), now.getMinutes())
    
                var messageDateString = moment(newDate).format('DD') + '.' + moment(newDate).format('MM') + '.' + 
                                        moment(newDate).format('YYYY') + ' ' + moment(newDate).format('HH') + ':' + 
                                        moment(newDate).format('mm') + ':00' 
    
                const done = await createSetupEntryCompleteDate(messageDateString,name);
                //const loop = await loopsetup();
                
            }
            else{
                adapter.log.error('M 1.3: ' + name + ': Adding ' + obj.message.addmonths + ' is invalid')
            }
        }
        else if (typeof obj.message.addyears != 'undefined'){
            if (obj.message.addyears != '' && obj.message.addyears != '0' && parseInt(obj.message.addyears)){            
             
                var now = new Date(); //todays date
                var toAdd = Number(obj.message.addyears)
                var newDate = new Date(now.getFullYear() + toAdd, now.getMonth(), now.getDate(), now.getHours(), now.getMinutes())
                var messageDateString = moment(newDate).format('DD') + '.' + moment(newDate).format('MM') + '.' + 
                                        moment(newDate).format('YYYY') + ' ' + moment(newDate).format('HH') + ':' + 
                                        moment(newDate).format('mm') + ':00' 
    
                const done = await createSetupEntryCompleteDate(messageDateString,name);
                //const loop = await loopsetup();
    
            }
            else{
                adapter.log.error('M 1.3: ' + name + ': Adding ' + obj.message.addyears + ' is invalid')
            }
        }
        else if (countProperties(obj.message) >= 2 && typeof obj.message.year != 'undefined')
        {
            if (obj.message.year != ''){
                var messageyeartring = obj.message.year
                var messageyearInt = 0
                if(messageyearInt = parseInt(messageyeartring)){
                    // is int
                    year = messageyeartring;
                }
                else
                {
                    adapter.log.error('M 1.4: Could not create countdown as year value is no int!');
                    erroroccured = true;
                }
                if ((year == 0) || (year > 2100) ){
                    adapter.log.error('M 1.4: Could not create countdown as year value is not valid: ' + year);
                    erroroccured = true;
                }
            }

            if (obj.message.month != ''){
                var messagemonthString = ''
                var messageMonthInt = 0
                messagemonthString = obj.message.month.replace(/[^0-9]+/g, '')
                if(messageMonthInt = parseInt(messagemonthString)){
                    // is int
                    if (messageMonthInt <=9) {
                        month = '0' + messageMonthInt;
                    }
                    else{
                        month = messageMonthInt.toString();
                    }
                    if ((messageMonthInt == 0) || (messageMonthInt > 12) ){
                        adapter.log.error('M 1.4: Could not create countdown as month value is not valid: ' + messageMonthInt);
                        erroroccured = true;
                    }
                }
                else
                {
                    adapter.log.error('M 1.4: Could not create countdown as month value is no int! Value: ' + messageMonthInt);
                    erroroccured = true;
        
                }
            }
            if (obj.message.day != ''){
                var messagDayString = ''
                var messageDayInt = 0
                messagDayString = obj.message.day.replace(/^0+/, '')
                if(messageDayInt = parseInt(messagDayString)){
                    // is 
                    if (messageDayInt <=9) {
                        day = '0' + messageDayInt;
                    }
                    else{
                        day = messageDayInt.toString();
                    }
                }
                else
                {
                    adapter.log.error('M 1.4: Could not create countdown as day value is no int!');
                    erroroccured = true;
        
                }
                if ((messageDayInt == 0) || (messageDayInt > 31) ){
                    adapter.log.error('M 1.4: Could not create countdown as day value is not valid: ' + messageDayInt);
                    erroroccured = true;
                }
            }
            if (obj.message.hour != ''){
                var messagHourString = ''
                var messageHourInt = 0
                messagHourString = obj.message.hour.replace(/^0+/, '')
    
                if(messageHourInt = parseInt(messagHourString)){
                    // is int
                    if (messageHourInt <=9) {
                        hour = '0' + messageHourInt;
                    }
                    else{
                        hour = messageHourInt.toString();
                    }
                }
                else
                {
                    hour = '00';
                }
                if (messageHourInt > 24 ){
                    adapter.log.error('M 1.4: Could not create countdown as hour value is not valid: ' + messageHourInt);
                    erroroccured = true;
                }
            }
            if (obj.message.minute != ''){
                var messagMinuteString = ''
                var messageMinuteInt = 0
                messagMinuteString = obj.message.minute.replace(/^0+/, '')
    
                if(messageMinuteInt = parseInt(messagMinuteString)){
                    // is int
                    if (messageMinuteInt <=9) {
                        minute = '0' + messageMinuteInt;
                    }
                    else{
                        minute = messageMinuteInt.toString();
                    }
                }
                else
                {
                    minute = '00'
                }
                if (messageMinuteInt > 60 ){
                    adapter.log.error('M 1.4: Could not create countdown as minute value is not valid: ' + messageMinuteInt);
                    erroroccured = true;
                }
            }
            //adapter.log.debug('Error occured: ' + erroroccured)
        
            if (erroroccured == false){
                adapter.log.debug('M 1.5: Creating Setup Entry')
                //adapter.log.debug('Values: day: ' + day + ' month: ' + month + ' year: ' + year + ' hour: ' + hour + ' minute: ' + minute)
                if ((day == '0')|| (year == 0)|| (month == '0')){
                    adapter.log.error('M 1.5.1: Date component invalid. Day: ' + day + ', Month: ' + month + ', Year: ' + year)
                }
                else{
                    const done = await createSetupEntry(day,month,year,hour,minute,name);
                }
                //const loop = await loopsetup();
            }
                
        }
        else if (countProperties(obj.message) == 1){
            adapter.log.info('M 2. Delete countdown: ' +name);
            deleteCountdownSetup(name);
            deleteCountdownResults(name);
        }
        else{
            adapter.log.error('M 1.1:  Wrong parameters for: ' +name + ', Parameter count: ' + countProperties(obj.message))
        }   
        adapter.log.debug('M 1.9: Finished processing Message')
        resolve('done')


    })

    
}

async function createSetupEntry(day,month,year,hour,minute,name){

    var datestring = day + "." + month + "." + year + " " + hour + ":" + minute + ":00";
    adapter.log.debug('M 1.6: Creating setup entry for date ' + datestring)

    const obj_new = await adapter.getObjectAsync('setup.' + name);
    if (obj_new != null) {
        const promises = await adapter.setStateAsync({device: 'setup', state: name}, {val: datestring, ack: true});
        adapter.log.debug('M 1.7: Setup Entry updated for countdown: ' + name)
    } 
    else {
        const promises = await adapter.createStateAsync('', 'setup', name, {
            read: true, 
            write: true, 
            name: name, 
            type: "string", 
            def: datestring,
            role: 'value'
          })
          adapter.log.debug('M 1.7: Setup Entry created  for countdown: ' + name)
    }
    
}

async function createSetupEntryCompleteDate(messageDateString,name){
    const obj_new = await adapter.getObjectAsync('setup.' + name);
    if (obj_new != null) {
        const promises = await adapter.setStateAsync({device: 'setup', state: name}, {val: messageDateString, ack: true});
        adapter.log.debug('M 1.7: Setup Entry updated for countdown: ' + name)
    } 
    else {

    const promises = await adapter.createStateAsync('', 'setup', name, {
        read: true, 
        write: true, 
        name: name, 
        type: "string", 
        def: messageDateString,
        role: 'value'
    
        });
        adapter.log.debug('M 1.7: Setup Entry created   for countdown: ' + name)
    }
}

async function updateCountdownTable(){

    const promises = await Promise.all([
        adapter.setState({ state: 'htmlContent'}, {val: tableify(tableArray), ack: true}),
        adapter.setState({ state: 'jsonContent'}, {val: JSON.stringify(tableArray), ack: true})
    ])
    adapter.log.debug('3.1 Found ' + tableArray.length + ' countdowns for JSON and HTML')

}


async function createObjects(CountName){
    //adapter.log.debug('Start creating Objects')
    const promises = await Promise.all([

    adapter.setObjectNotExistsAsync('countdowns.' + CountName, {
            common: {
                  name: CountName
            },
            type: 'channel',
            'native' : {}
    }),

    adapter.createStateAsync('countdowns', CountName, 'name', { 
            read: true, 
            write: true, 
            name: "Name", 
            type: 'string', 
            def: CountName,
            role: 'value'
    }),
    

    adapter.createStateAsync('countdowns', CountName, 'reached', {
            read: true, 
            write: true, 
            name: "Reached", 
            type: "boolean", 
            def: false,
            role: 'value'
    }),

    adapter.createStateAsync('countdowns', CountName, 'countUp', {
        read: true, 
        write: true, 
        name: "CountUp", 
        type: "boolean", 
        def: false,
        role: 'value'
}),

    adapter.createStateAsync('countdowns', CountName, 'years', {
            read: true, 
            write: true, 
            name: "Years", 
            type: "number", 
            def: 0,
            role: 'value'
		
    }),

    adapter.createStateAsync('countdowns', CountName, 'months', {
        read: true, 
        write: true, 
        name: "Months", 
        type: "number", 
        def: 0,
        role: 'value'
      }),

      adapter.createStateAsync('countdowns', CountName, 'days', {
        read: true, 
        write: true, 
        name: "Days", 
        type: "number", 
        def: 0,
        role: 'value'
      }),

      adapter.createStateAsync('countdowns', CountName, 'hours', {
        read: true, 
        write: true, 
        name: "Hours", 
        type: "number", 
        def: 0,
        role: 'value'
      }),

      adapter.createStateAsync('countdowns', CountName, 'minutes', {
        read: true, 
        write: true, 
        name: "Minutes", 
        type: "number", 
        def: 0,
        role: 'value'
      }),

      adapter.createStateAsync('countdowns', CountName, 'inWordsLong', {
        read: true, 
        write: true, 
        name: "Result in Words Long", 
        type: "string", 
        def: '',
        role: 'value'
      }),

     adapter.createStateAsync('countdowns', CountName, 'inWordsShort', {
        read: true, 
        write: true, 
        name: "Result in Words Short", 
        type: "string", 
        def: '',
        role: 'value'
      }),

      adapter.createStateAsync('countdowns', CountName, 'endDate', {
        read: true, 
        write: true, 
        name: "Enddate", 
        type: "string", 
        def: '',
        role: 'value'
      }),

      adapter.createStateAsync('countdowns', CountName, 'totalDays', {
        read: true, 
        write: true, 
        name: "Total no. of days", 
        type: "number", 
        def: 0,
        role: 'value'
      }),

      adapter.createStateAsync('countdowns', CountName, 'totalHours', {
        read: true, 
        write: true, 
        name: "Total no. of hours", 
        type: "number", 
        def: 0,
        role: 'value'
      }),

      adapter.createStateAsync('countdowns', CountName, 'totalWeeks', {
        read: true, 
        write: true, 
        name: "Total no. of weeks", 
        type: "number", 
        def: 0,
        role: 'value'
      }),
      adapter.createStateAsync('countdowns', CountName, 'totalMonths', {
        read: true, 
        write: true, 
        name: "Total no. of months", 
        type: "number", 
        def: 0,
        role: 'value'
      }),
      adapter.createStateAsync('countdowns', CountName, 'totalYears', {
        read: true, 
        write: true, 
        name: "Total no. of years", 
        type: "number", 
        def: 0,
        role: 'value'
      }),
      adapter.createStateAsync('countdowns', CountName, 'json', {
        read: true, 
        write: true, 
        name: "Total as json", 
        type: "string", 
        def: 0,
        role: 'json'
      }),

      adapter.createStateAsync('countdowns', CountName, 'repeatEvery', {
        read: true, 
        write: true, 
        name: "Period when the Countdown should be repeated", 
        type: "string", 
        def: '',
        role: 'value'
      })

    ])
      //adapter.log.info('all states created')

      
}

function countProperties(obj) {
    var count = 0;

    for(var prop in obj) {
        if(obj.hasOwnProperty(prop))
            ++count;
    }

    return count;
}

function mydiff(date1,date2,interval) {
    var second=1000, minute=second*60, hour=minute*60, day=hour*24, week=day*7;
    date1 = new Date(date1);
    date2 = new Date(date2);
    // for Month calculation
    var date1Moment = moment(new Date(date1))
    var date2Moment = moment(new Date(date2))
    var timediff = date2 - date1;
    if (isNaN(timediff)) return NaN;
    switch (interval) {
        case "years": return date2.getFullYear() - date1.getFullYear();
        case "months": return date2Moment.diff(date1Moment, 'months', false);
        case "weeks"  : return Math.floor(timediff / week);
        case "days"   : return Math.floor(timediff / day); 
        case "hours"  : return Math.floor(timediff / hour); 
        case "minutes": return Math.floor(timediff / minute);
        case "seconds": return Math.floor(timediff / second);
        default: return undefined;
    }
}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
} 
