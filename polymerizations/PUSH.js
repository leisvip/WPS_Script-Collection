/*
    脚本名称：PUSH.js
    脚本兼容: airsript 1.0、airscript 2.0
    更新时间：20241226
    具备功能：
            1. 多渠道推送
            2. 独立推送、消息池推送
            3. 消息过期判断
            4. 长度分片、分隔符分片
            5. 优先级排序
            6. 单日多次推送
            7. 消息池内格式自动排版
    支持推送：
            bark、pushplus、Server酱、邮箱
            钉钉、discord、企业微信
            息知、即时达、wxpusher
*/

var sheetNameConfig = "CONFIG"; // 总配置表
var sheetNamePush = "PUSH"; // 推送表名称
var sheetNameEmail = "EMAIL"; // 邮箱表
var flagSubConfig = 0; // 激活分配置工作表标志
var flagConfig = 0; // 激活主配置工作表标志
var flagPush = 0; // 激活推送工作表标志
var line = 21; // 指定读取从第2行到第line行的内容
var message = ""; // 待发送的消息
var messagePushHeader = ""; // 存放在总消息的头部，默认是pushHeader,如：【xxxx】
var pushHeader = ""
var separator = "##########MOKU##########" // 分割符，分割消息。可用于PUSH.js灵活推送
var maxMessageLength = 512;  // 设置最大长度，超过这个长度则分片发送
var messageDistance = 256; // 消息距离，用于匹配100字符内最近的行
var version = 1 // 版本类型，自动识别并适配。默认为airscript 1.0，否则为2.0（Beta）

var jsonPush = [
  { name: "bark", key: "xxxxxx", flag: "0" },
  { name: "pushplus", key: "xxxxxx", flag: "0" },
  { name: "ServerChan", key: "xxxxxx", flag: "0" },
  { name: "email", key: "xxxxxx", flag: "0" },
  { name: "dingtalk", key: "xxxxxx", flag: "0" },
  { name: "discord", key: "xxxxxx", flag: "0" },
  { name: "qywx", key: "xxxxxx", flag: "0" },
  { name: "xizhi", key: "xxxxxx", flag: "0" },
  { name: "jishida", key: "xxxxxx", flag: "0" },
  { name: "wxpusher", key: "xxxxxx", flag: "0" },
]; // 推送数据，flag=1则推送
var jsonEmail = {
  server: "",
  port: "",
  sender: "",
  authorizationCode: "",
}; 

// airscript检测版本
function checkVesion(){
  try{
    let temp = Application.Range("A1").Text;
    Application.Range("A1").Value  = temp
    console.log("😶‍🌫️ 检测到当前airscript版本为1.0，进行1.0适配")
  }catch{
    console.log("😶‍🌫️ 检测到当前airscript版本为2.0，进行2.0适配")
    version = 2
  }
}

// 消息分片，以换行符为分割，自动检索切割位置符号
function splitMessage(data) {
    let chunks = [];
    let start = 0;

    while (start < data.length) {
        let end = start + maxMessageLength;
        if (end >= data.length) {
            chunks.push(data.slice(start));
            break;
        }

        // 查找距离 maxMessageLength 在 20 字符以内的最近的换行符
        let newlineIndex = data.lastIndexOf('【', end + parseInt(messageDistance));
        // console.log(newlineIndex)
        if (newlineIndex > start && newlineIndex >= end - parseInt(messageDistance)) {
            end = newlineIndex;
        }

        chunks.push(data.slice(start, end));
        start = end;
    }

    return chunks
}

// 纯长度分片
// function splitMessage(data) {
//     let chunks = [];
//     for (let i = 0; i < data.length; i += maxMessageLength) {
//         chunks.push(data.slice(i, i + maxMessageLength));
//     }

//     return chunks

//     // chunks.forEach((chunk, index) => {
//     //     // let message = `${index + 1}/${chunks.length}: ${chunk}`;
//     //     bark(message, key)
//     // });
// }

// 去除首尾换行和空格
function customTrim(str) {
  return str.replace(/^\s+|\s+$/g, '');
}

// 获取时间
function getDate(){
  let currentDate = new Date();
  // 2024/07/04
  // currentDate = currentDate.getFullYear() + '' + (currentDate.getMonth() + 1).toString().padStart(2, '0') + '' + currentDate.getDate().toString().padStart(2, '0');
  currentDate = currentDate.getFullYear() + '/' + (currentDate.getMonth() + 1).toString() + '/' + currentDate.getDate().toString();
  
  return currentDate
}

checkVesion()

// 当天时间
var todayDate = getDate()
getPush()   // 读取推送配置
var msgArray = [] // 存放消息内容
getMessage()  // 读取消息配置
sendNotify()  // 消息推送
// console.log(jsonPush)
// console.log(jsonEmail)

// 激活工作表函数
function ActivateSheet(sheetName) {
    let flag = 0;
    try {
      // 激活工作表
      let sheet = Application.Sheets.Item(sheetName);
      sheet.Activate();
      console.log("🥚 激活工作表：" + sheet.Name);
      flag = 1;
    } catch {
      flag = 0;
      console.log("🍳 无法激活工作表，工作表可能不存在");
    }
    return flag;
}

// 对推送数据进行处理
function jsonPushHandle(pushName, pushFlag, pushKey) {
  let length = jsonPush.length;
  for (let i = 0; i < length; i++) {
    if (jsonPush[i].name == pushName) {
      if (pushFlag == "是") {
        jsonPush[i].flag = 1;
        jsonPush[i].key = pushKey;
      }else{  // 不推送
        jsonPush[i].flag = 0;
        jsonPush[i].key = pushKey;
      }
    }
  }
}

// 读取推送配置
function getPush(){
  flagPush = ActivateSheet(sheetNamePush); // 激活推送表
  // 推送工作表存在
  if (flagPush == 1) {
    console.log("🍳 开始读取推送工作表");
    let pushName; // 推送类型
    let pushKey;
    let pushFlag; // 是否推送标志
    for (let i = 2; i <= line; i++) {
      // 从工作表中读取推送数据
      pushName = Application.Range("A" + i).Text;
      pushKey = Application.Range("B" + i).Text;
      pushFlag = Application.Range("C" + i).Text;
      if (pushName == "") {
        // 如果为空行，则提前结束读取
        break;
      }
      jsonPushHandle(pushName, pushFlag, pushKey);
    }
    // console.log(jsonPush)
  }

  // 邮箱配置函数
  emailConfig();
}

// 休眠
function sleep(d) {
  for (var t = Date.now(); Date.now() - t <= d; );
}

// 推送优先级排序
function sortMsgArrayByPriority(msgArray) {
    return msgArray.sort((a, b) => b.priority - a.priority);
}

// 读取消息配置
function getMessage(){
  flagConfig = ActivateSheet(sheetNameConfig); // 激活主配置表
  // 主配置工作表存在
  if (flagConfig == 1) {
    console.log("🍳 开始读取主配置表");

    // var configTitleMapping = {
    //     '工作表的名称': 'name',
    //     '备注': 'note',
    //     '只推送失败消息（是/否）': 'pushFailureOnly',
    //     '推送昵称（是/否）': 'pushNickname',
    //     '是否存活': 'isAlive',
    //     '更新时间': 'updateTime',
    //     '消息': 'message',
    //     '推送时间': 'pushTime',
    //     '推送方式': 'pushMethod',
    //     '是否通知': 'notify',
    //     '加入消息池': 'addToMessagePool',
    //     '推送优先级': 'pushPriority',
    //     '当日可推送次数': 'dailyPushLimit',
    //     '当日剩余推送次数': 'remainingDailyPushes',
    // };

    for (let i = 2; i <= 100; i++) {
      // 从工作表中读取推送数据
      let msgDict = {
        "pos": 0,          // 位置，记录在表格的第几行，从2开始
        "name": "",       // 名称
        "note": "",   // 备注
        // "onlyError":  "", // 只推送错误消息
        "update":"",       // 脚本更新时间，即脚本是否已执行
        "msg" : "",       // 待推送消息
        "date": "",       // 推送时间，即单天是否已推送
        "methodPush":"",  // 推送方式
        "flagPush" : "",  // 是否通知
        "pool":"",        // 是否加入消息池，加入消息池的都会整合为一条消息统一推送
        "priority":"0",     // 优先级，根据优先级来对消息前后顺序进行排序
        "dailyPushLimit":1, // 当日可推送次数
        "remainingDailyPushes": ""  // 当日剩余推送次数
      }

      msgDict.pos = i    // 位置，在第几行，从2开始
      msgDict["name"] = Application.Range("A" + i).Text;     // 工作表名称
      msgDict.note = Application.Range("B" + i).Text;     // 备注
      // msgDict.onlyError = Application.Range("C" + i).Text;     // 只推送错误消息
      msgDict.update = Application.Range("F" + i).Text;     // 脚本更新时间，即脚本是否已执行
      msgDict.msg = Application.Range("G" + i).Text;     // 待推送消息
      msgDict.date = Application.Range("H" + i).Text;     // 推送时间，即单天是否已推送
      msgDict.methodPush = Application.Range("I" + i).Text;     // 推送方式
      msgDict.flagPush = Application.Range("J" + i).Text;     // 是否通知
      msgDict.pool = Application.Range("K" + i).Text;     // 是否加入消息池，加入消息池的都会整合为一条消息统一推送
      msgDict.priority = Application.Range("L" + i).Text;     // 优先级，根据优先级来对消息前后顺序进行排序
      msgDict.dailyPushLimit = Application.Range("M" + i).Text;    // 当日可推送次数
      msgDict.remainingDailyPushes = Application.Range("N" + i).Text;    // 当日剩余推送次数

    
      if (msgDict.name == "") {
        // 如果为空行，则提前结束读取
        break; // 提前退出，提高效率
      }
      // console.log(msgDict)
      msgArray.push(msgDict)
    }

    // 根据优先级排序，值大的排前面
    msgArray = sortMsgArrayByPriority(msgArray) 
    // console.log(msgArray)
    
  }
}

// 将日期转换为一串可比较的数字 2024/9/17 -> 20240917。隔月存在问题
function convertToDateNumber(dateString) {
    const [year, month, day] = dateString.split('/').map(Number);
    return year * 10000 + (month * 100) + day;
}

// 计算两个日期之间的距离
function dateDistance(oldDate, newDate){
  // 定义两个日期，2024/9/17
  let date1 = new Date(oldDate);
  let date2 = new Date(newDate);
  let diffInMilliseconds = date2 - date1; // 计算两个日期之间的毫秒差
  let diffInDays = diffInMilliseconds / (1000 * 60 * 60 * 24);  // 将毫秒差转换为天数
  return diffInDays // 返回天数 0-n
}

// 推送器
function sendMessage(msgCurrentDict = "", msgPool = "", msgAppend = ""){
  
  let shards = [] // 分割符分片数据，一级分割
  
  if(msgCurrentDict != ""){
    // 独立推送
    console.log("🚀 消息推送：" + msgCurrentDict.note)
    // 消息分片
    // 方式1：按照指定分割符分片  separator
    shards = msgCurrentDict.msg.split(separator); // // 分割符分片数据，一级分割
    let chunks = []
    for(let i=0; i<shards.length; i++){
      strTrim = customTrim(shards[i]) + "\n\n" // 消息内间隔。去除首位空格和换行，然后在末尾拼接2个换行。
      chunks = splitMessage(strTrim)  // 长度限制分割，二级分割
      // console.log(chunks)
      // console.log(chunks.length)
      for (let j = 0; j < chunks.length; j++) {
          pushMessage(chunks[j], msgCurrentDict.methodPush, "【" + msgCurrentDict.note + "】",)
          sleep(2000)
      }
    }

  }else{
    // 消息池推送
    console.log("🚀 艾默库消息池推送")
    // 消息分片
    // 方式1：按照指定分割符分片  separator
    msgPool += msgAppend  // 追加数据
    shards = msgPool.split(separator);
    let chunks = []
    for(let i=0; i<shards.length;i++){
      strTrim = customTrim(shards[i]) + "\n\n" // 消息内间隔。去除首位空格和换行，然后在末尾拼接2个换行
      chunks = splitMessage(strTrim)
      // console.log(chunks)
      // console.log(chunks.length)
      for (let j = 0; j < chunks.length; j++) {
          // console.log(chunks[i])
          pushMessage(chunks[j], "@all", "【" + "艾默库消息池" + "】\n")
          sleep(2000)
      }
    }


  }

}


// 发送消息
function sendNotify(){
  ActivateSheet(sheetNameConfig); // 激活主配置表

  // console.log("🍳 开始发送消息");
  let msgCurrentDict = ""
  let msgPool = ""
  let msgAppend = ""  // 追加到消息池末尾的信息
  let shards = [] // 分割符分片数据，一级分割
  for (let i = 0; i < msgArray.length; i++) {
    msgCurrentDict = msgArray[i]
    // console.log(msgCurrentDict)
    // {"name":"aliyundrive_multiuser","note":"阿里云盘（多用户版）","msg":"","date":"","methodPush":"","flagPush":"@all"}
    // 从读取推送数据
    // if(msgCurrentDict.flagPush == "是" && msgCurrentDict.update != "" && msgCurrentDict.date == ""){  // 第一次执行时更新时间不为空，推送时间为空
    // }

    // console.log(msgCurrentDict.date)
    // console.log(todayDate)
    // 消息池的先不推送，最后统一推送
    // 1. 消息池判断，使得消息池内的消息最后统一推送
    // 2. 是否推送判断，使得仅勾选是的才进行推送
    // 3. 推送时间判断，使得仅今天未推送才进行推送，如果今天已推送就不再推送了，目的是可以一天不同时间段任意设置多个定时PUSH推送脚本
    // 4. 过期消息判断，如果运行时间是2天前的消息就不再推送了
    // 5. 时间不一致判断，更新时间和推送时间不一致才推送，此判断也可以使昨天签到成功且今天未签到的情况不推送。即只有今天签到且未推送的情况才进行推送
    // 6. 时间一致额外推送判断。即一天多次运行，并多次推送
    // console.log(msgCurrentDict.update)  2024/9/29  脚本运行时间
    // console.log(msgCurrentDict.date)  // 2024/10/30 上一次推送时间
    // todayDate = "2024/11/1"  // 测试

    // // 计算是否能额外推送
    // msgDict.dailyPushLimit  // 当日可推送次数
    // msgDict.remainingDailyPushes  // 当日剩余推送次数

    // 1. 消息池判断
    // 2. 是否推送判断
    if(msgCurrentDict.pool == "否" && msgCurrentDict.flagPush == "是")
    {
      // 独立推送
      // 3.进行消息检测
      // 4.进行过期消息判断
      if(msgCurrentDict.msg != "" && dateDistance(msgCurrentDict.update, todayDate) <= 2 && dateDistance(msgCurrentDict.update, todayDate) >= 0)
      {
        // 5.时间不一致判断
        if(msgCurrentDict.update != msgCurrentDict.date && msgCurrentDict.date != todayDate )
        { 
          // 时间不一致说明未推送。消息为空不进行推送。今天未推送
          // 进行推送
          
          // pushMessage(msgCurrentDict.msg, msgCurrentDict.methodPush, "【" + msgCurrentDict.note + "】",)
          sendMessage(msgCurrentDict)

          // 写入推送的时间
          // Application.Range("H" + (i + 2)).Value = todayDate
          if(version == 1){
            Application.Range("H" + msgCurrentDict.pos).Value = todayDate
            // 更新推送次数。读取当日可推送次数，写入当日剩余推送次数。写入当日剩余推送次数 = 当日可推送次数 - 1
            Application.Range("N" + msgCurrentDict.pos).Value =  parseInt(msgCurrentDict.dailyPushLimit) - 1
          }else{
            Application.Range("H" + msgCurrentDict.pos).Value2 = todayDate
            // 更新推送次数。读取当日可推送次数，写入当日剩余推送次数。写入当日剩余推送次数 = 当日可推送次数 - 1
            Application.Range("N" + msgCurrentDict.pos).Value2 =  parseInt(msgCurrentDict.dailyPushLimit) - 1
          }
          

        }else{  
          //  6.时间一致额外推送判断
          // 时间一致，计算是否推送
          if(parseInt(msgCurrentDict.remainingDailyPushes) > 0){
            sendMessage(msgCurrentDict)
            if(version == 1){
              // 写入推送的时间
              Application.Range("H" + msgCurrentDict.pos).Value = todayDate
              // 更新推送次数。读取当日可推送次数，写入当日剩余推送次数。写入当日剩余推送次数 = 当日可推送次数 - 1
              Application.Range("N" + msgCurrentDict.pos).Value =  parseInt(msgCurrentDict.remainingDailyPushes) - 1
            }else{
              // 写入推送的时间
              Application.Range("H" + msgCurrentDict.pos).Value2 = todayDate
              // 更新推送次数。读取当日可推送次数，写入当日剩余推送次数。写入当日剩余推送次数 = 当日可推送次数 - 1
              Application.Range("N" + msgCurrentDict.pos).Value2 =  parseInt(msgCurrentDict.remainingDailyPushes) - 1
            }
            
          }
          
        }
      }

    }else{
      if(msgCurrentDict.pool == "是" && msgCurrentDict.flagPush == "是"){
        // 消息池推送
        // 3.进行消息检测
        // 4.进行过期消息判断
        if(msgCurrentDict.msg != "" && dateDistance(msgCurrentDict.update, todayDate) <= 2 && dateDistance(msgCurrentDict.update, todayDate) >= 0)
        {
          // 5.时间不一致判断
          if(msgCurrentDict.update != msgCurrentDict.date && msgCurrentDict.date != todayDate ){
            // 时间不一致说明未推送。

            // 进行消息池生成
            // 对分片消息进行特异化处理，只取第一条分片，后续分片放在消息池的末尾
            shards = msgCurrentDict.msg.split(separator); // // 分割符分片数据，一级分割
            // console.log(shards)
            msgPool += "【" + msgCurrentDict.note + "】" + shards[0] + "\n" // 取分割后的第一条
            for(let j=1; j<shards.length; j++){ // 后续一级分割分片数据放入追加数据当中
              msgAppend += "【" + msgCurrentDict.note + "】" + shards[j] + "\n" // 取分割后的第一条
            }

            if(version == 1){
              // 写入推送的时间
              // Application.Range("H" + (i + 2)).Value = todayDate
              Application.Range("H" + msgCurrentDict.pos).Value = todayDate
              // 更新推送次数。读取当日可推送次数，写入当日剩余推送次数。写入当日剩余推送次数 = 当日可推送次数 - 1
              Application.Range("N" + msgCurrentDict.pos).Value =  parseInt(msgCurrentDict.dailyPushLimit) - 1
            }else{
              // 写入推送的时间
              // Application.Range("H" + (i + 2)).Value = todayDate
              Application.Range("H" + msgCurrentDict.pos).Value2 = todayDate
              // 更新推送次数。读取当日可推送次数，写入当日剩余推送次数。写入当日剩余推送次数 = 当日可推送次数 - 1
              Application.Range("N" + msgCurrentDict.pos).Value2 =  parseInt(msgCurrentDict.dailyPushLimit) - 1
            }
            
          }else{
            // 6.时间一致额外推送判断
            // 时间一致，计算是否推送
            if(parseInt(msgCurrentDict.remainingDailyPushes) > 0){
              // 进行消息池生成
              // 对分片消息进行特异化处理，只取第一条分片，后续分片放在消息池的末尾
              shards = msgCurrentDict.msg.split(separator); // // 分割符分片数据，一级分割
              // console.log(shards)
              msgPool += "【" + msgCurrentDict.note + "】" + shards[0] + "\n" // 取分割后的第一条
              for(let j=1; j<shards.length; j++){ // 后续一级分割分片数据放入追加数据当中
                msgAppend += "【" + msgCurrentDict.note + "】" + shards[j] + "\n" // 取分割后的第一条
              }

              if(version == 1){
                // 写入推送的时间
                Application.Range("H" + msgCurrentDict.pos).Value = todayDate
                // 更新推送次数。读取当日可推送次数，写入当日剩余推送次数。写入当日剩余推送次数 = 当日可推送次数 - 1
                Application.Range("N" + msgCurrentDict.pos).Value =  parseInt(msgCurrentDict.remainingDailyPushes) - 1
              }else{
                // 写入推送的时间
                Application.Range("H" + msgCurrentDict.pos).Value2 = todayDate
                // 更新推送次数。读取当日可推送次数，写入当日剩余推送次数。写入当日剩余推送次数 = 当日可推送次数 - 1
                Application.Range("N" + msgCurrentDict.pos).Value2 =  parseInt(msgCurrentDict.remainingDailyPushes) - 1
              }
              
            }

          }

        }
        

        // console.log("🧩 加入消息池：" + msgCurrentDict.note)
        // msgPool += "【" + msgCurrentDict.note + "】" + msgCurrentDict.msg + "\n"

        

      }else{
        // console.log("🍳 不进行推送：" + msgCurrentDict.note)
      }
    }
    
  }
  
  // console.log(msgPool)
  // 消息池推送，消息池默认以@all方式推送
  let msgPoolJuice = msgPool.replace(/\n/g, '');  // 判断消息池内是否有数据
  // console.log(msgPoolJuice)
  if(msgPoolJuice != ""){ // 消息池内有消息才推送
    
    // pushMessage(msgPool, "@all", "【" + "艾默库消息池" + "】\n")
    sendMessage("", msgPool, msgAppend)


  }

  console.log("🎉 推送结束")
}

// 使用正则表达式匹配以'http://'或'https://'开头的字符串
function isHttpOrHttpsUrl(url) {
    // '^'表示字符串的开始，'i'表示不区分大小写
    const regex = /^(http:\/\/|https:\/\/)/i;
    // match() 方法返回一个包含匹配结果的数组，如果没有匹配项则返回 null
    return url.match(regex) !== null;
}

// 消息分割，返回消息推送方式数组
function pushSplit(method){
  // console.log(method)
  let arry = []
  arry = method.split("&") // 使用&作为分隔符
  // console.log(arry)
  return arry
}

// 总推送
function pushMessage(message, method, pushHeader){
  messagePushHeader = pushHeader
  if (method == "@all") { // 所有渠道都推送
    // console.log("🚀 所有渠道都推送");
    // message = messagePushHeader + message // 消息头最前方默认存放：【xxxx】
    let length = jsonPush.length;
    let name;
    let key;
    for (let i = 0; i < length; i++) {
      if (jsonPush[i].flag == 1) {
        name = jsonPush[i].name;
        key = jsonPush[i].key;
        
        let keySub = pushSplit(key)
        for (let i = 0; i < keySub.length; i++) {
          pushUnit(message, keySub[i], name)
        }
      }
    }
  } else {
    // console.log("🚀 多消息推送");
    let arry = pushSplit(method)
    let methodCurrent = ""

    let length = jsonPush.length;
    let name;
    let key;

    for (let i = 0; i < arry.length; i++) {
      methodCurrent = arry[i]
      // console.log(methodCurrent)
      for (let i = 0; i < length; i++) {
        name = jsonPush[i].name;
        if(name == methodCurrent){
          // console.log(methodCurrent)
          if (jsonPush[i].flag == 1) {
            key = jsonPush[i].key;

            let keySub = pushSplit(key)
            for (let i = 0; i < keySub.length; i++) {
              pushUnit(message, keySub[i], name)
            }

          }
          break;  // 找到推送方式就提前退出
        }
      } 
    }
  }
}

// 推送执行
function pushUnit(message, key, name){
  try{
    if (name == "bark") {
      bark(message, key);
    } else if (name == "pushplus") {
      pushplus(message, key);
    } else if (name == "ServerChan") {
      serverchan(message, key);
    } else if (name == "email") {
      email(message);
    } else if (name == "dingtalk") {
      dingtalk(message, key);
    } else if (name == "discord") {
      discord(message, key);
    }else if (name == "qywx"){
      qywx(message, key);
    } else if (name == "xizhi") {
      xizhi(message, key);
    }else if (name == "jishida"){
      jishida(message, key);
    }else if (name == "wxpusher"){
      wxpusher(message, key)
    }
  }catch{
    console.log("📢 存在推送失败：" + name)
  }
}

// 推送bark消息
function bark(message, key) {
  message = messagePushHeader + message // 消息头最前方默认存放：【xxxx】
  message = encodeURIComponent(message)
  BARK_ICON = "https://s21.ax1x.com/2024/06/23/pkrUkfe.png"
  let url = ""
  if(isHttpOrHttpsUrl(key)){  // 以http开头
    url = key + "/" + message + "/" + "?icon=" + BARK_ICON
  }else{
    url = "https://api.day.app/" + key + "/" + message + "/" + "?icon=" + BARK_ICON;
  }
  
  // 若需要修改推送的分组，则将上面一行改为如下的形式
  // let url = 'https://api.day.app/' + bark_id + "/" + message + "?group=分组名";
  let resp = HTTP.get(url, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  // console.log(resp.json())
  sleep(5000);
}

// 推送pushplus消息
function pushplus(message, key) {
  message = encodeURIComponent(message)
  let url = ""
  if(isHttpOrHttpsUrl(key)){  // 以http开头
    url = key + "&content=" + message + "&title=" + messagePushHeader;
  }else{
    url = "http://www.pushplus.plus/send?token=" + key + "&content=" + message + "&title=" + messagePushHeader;  // 增加标题
  }

  // url = "http://www.pushplus.plus/send?token=" + key + "&content=" + message;
  // let resp = HTTP.fetch(url, {
  //   method: "get",
  // });
  headers = {}
  resp = HTTP.get(url, {headers: headers,});
  sleep(5000);
}

// 推送serverchan消息，方糖
function serverchan(message, key) {
  message = message.replace(/\n/g, '\n\n'); // 单独适配，将一个换行变成两个，以实现换行
  message = encodeURIComponent(message)
  
  let url = ""
  if(isHttpOrHttpsUrl(key)){  // 以http开头
    url = key + "?title=" + messagePushHeader + "&desp=" + message;
  }else{
    url = "https://sctapi.ftqq.com/" + key + ".send?title=" + messagePushHeader + "&desp=" + message;
  }

  // let resp = HTTP.fetch(url, {
  //   method: "get",
  // });
  headers = {}
  resp = HTTP.get(url, {headers: headers,});
  sleep(5000);
}

// email邮箱推送
function email(message) {
  var myDate = new Date(); // 创建一个表示当前时间的 Date 对象
  var data_time = myDate.toLocaleDateString(); // 获取当前日期的字符串表示
  let server = jsonEmail.server;
  let port = parseInt(jsonEmail.port); // 转成整形
  let sender = jsonEmail.sender;
  let authorizationCode = jsonEmail.authorizationCode;

  let mailer;
  mailer = SMTP.login({
    host: server,
    port: port,
    username: sender,
    password: authorizationCode,
    secure: true,
  });
  mailer.send({
    from: pushHeader + "<" + sender + ">",
    to: sender,
    subject: pushHeader + " - " + data_time,
    text: message,
  });
  // console.log("🍳 已发送邮件至：" + sender);
  console.log("🍳 已发送邮件");
  sleep(5000);
}

// 邮箱配置
function emailConfig() {
  // console.log("🍳 开始读取邮箱配置");
  let length = jsonPush.length; // 因为此json数据可无序，因此需要遍历
  let name;
  for (let i = 0; i < length; i++) {
    name = jsonPush[i].name;
    if (name == "email") {
      if (jsonPush[i].flag == 1 || 1) { // 始终读取
        let flag = ActivateSheet(sheetNameEmail); // 激活邮箱表
        // 邮箱表存在
        // var email = {
        //   'email':'', 'port':'', 'sender':'', 'authorizationCode':''
        // } // 有效配置
        if (flag == 1) {
          console.log("🍳 开始读取邮箱表");
          for (let i = 2; i <= 2; i++) {
            // 从工作表中读取推送数据
            jsonEmail.server = Application.Range("A" + i).Text;
            jsonEmail.port = Application.Range("B" + i).Text;
            jsonEmail.sender = Application.Range("C" + i).Text;
            jsonEmail.authorizationCode = Application.Range("D" + i).Text;
            if (Application.Range("A" + i).Text == "") {
              // 如果为空行，则提前结束读取
              break;
            }
          }
          // console.log(jsonEmail)
        }
        break;
      }
    }
  }
}

// 推送钉钉机器人
function dingtalk(message, key) {
  message = messagePushHeader + message // 消息头最前方默认存放：【xxxx】

  let url = ""
  if(isHttpOrHttpsUrl(key)){  // 以http开头
    url = key
  }else{
    url = "https://oapi.dingtalk.com/robot/send?access_token=" + key;
  }

  let resp = HTTP.post(url, { msgtype: "text", text: { content: message } });
  // console.log(resp.text())
  sleep(5000);
}

// 推送Discord机器人
function discord(message, key) {
  message = messagePushHeader + message // 消息头最前方默认存放：【xxxx】
  let url = key;
  let resp = HTTP.post(url, { content: message });
  //console.log(resp.text())
  sleep(5000);
}

// 企业微信群推送机器人
function qywx(message, key) {
  message = messagePushHeader + "\n" + message // 消息头最前方默认存放：【xxxx】
  let url = ""
  if(isHttpOrHttpsUrl(key)){  // 以http开头
    url = key
  }else{
    url = "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=" + key;
  }
   
  data = {
    "msgtype": "text",
    "text": {
        "content": message
    }
  }
  let resp = HTTP.post(url, data);
  // console.log(resp.json())
  sleep(5000);
}

// 息知 https://xizhi.qqoq.net/{key}.send?title=标题&content=内容
function xizhi(message, key) {
  message = message.replace(/\n/g, '\n\n'); // 单独适配，将一个换行变成两个，以实现换行
  message = encodeURIComponent(message)
  let url = ""
  if(isHttpOrHttpsUrl(key)){  // 以http开头
    url = key + "?title=" + messagePushHeader + "&content=" + message;
  }else{
    url = "https://xizhi.qqoq.net/" + key + ".send?title=" + messagePushHeader + "&content=" + message;  // 增加标题
  }
  // let resp = HTTP.fetch(url, {
  //   method: "get",
  // });
  headers = {}
  resp = HTTP.get(url, {headers: headers,});
  sleep(5000);
}

// jishida http://push.ijingniu.cn/send?key=&head=&body=
function jishida(message, key) {
  message = encodeURIComponent(message)
  let url = ""
  if(isHttpOrHttpsUrl(key)){  // 以http开头
    url = key + "&head=" + messagePushHeader + "&body=" + message;
  }else{
    url = "http://push.ijingniu.cn/send?key=" + key + "&head=" + messagePushHeader + "&body=" + message;  // 增加标题
  }
  // let resp = HTTP.fetch(url, {
  //   method: "get",
  // });
  headers = {}
  resp = HTTP.get(url, {headers: headers,});
  sleep(5000);
}

// wxpusher 适配两种模式：极简推送、标准推送
function wxpusher(message, key) {
  message = message.replace(/\n/g, '<br>'); // 单独适配，将/n换行变成<br>，以实现换行
  message = encodeURIComponent(message)
  let keyarry= key.split("|") // 使用|作为分隔符
  if(keyarry.length == 1){ 
    // console.log("采用SPT极简推送")
    // https://wxpusher.zjiecode.com/api/send/message/你获取到的SPT/你要发送的内容
    // https://wxpusher.zjiecode.com/api/send/message/xxxx/ThisIsSendContent
    let url = ""
    if(isHttpOrHttpsUrl(key)){  // 以http开头
      // end = key.slice(-1)
      if(key.endsWith("/")){
        // 形如：https://wxpusher.zjiecode.com/api/send/message/你获取到的SPT/
        url = key + message 
      }else if(key.endsWith("ThisIsSendContent")){
        // 形如：https://wxpusher.zjiecode.com/api/send/message/xxxx/ThisIsSendContent
        key = key.slice(0, -"ThisIsSendContent".length);  // 去掉末尾的"ThisIsSendContent"
        url = key + message 
      }else{
        // 形如：https://wxpusher.zjiecode.com/api/send/message/你获取到的SPT
        url = key + "/" + message  
      }
    }else{
      // 形如：你获取到的SPT
      url = "https://wxpusher.zjiecode.com/api/send/message/" + key + "/" + message
    }
    // console.log(url)
    // let resp = HTTP.fetch(url, {
    //   method: "get",
    // });
    headers = {}
    resp = HTTP.get(url, {headers: headers,});
    // console.log(resp.text())
  }else{
    // console.log("采用标准推送")
    let appToken = keyarry[0]
    let uid = keyarry[1]
    let url = ""
    if(isHttpOrHttpsUrl(key)){  // 以http开头
      url = key + "&verifyPayType=0&content=" + message 
    }else{
      url = "https://wxpusher.zjiecode.com/api/send/message/?appToken=" + appToken + "&uid=" + uid + "&verifyPayType=0&content=" + message 
    }
    // console.log(url)
    // let resp = HTTP.fetch(url, {
    //   method: "get",
    // });
    headers = {}
    resp = HTTP.get(url, {headers: headers,});
    // console.log(resp.json())
  }
  sleep(5000);
}


