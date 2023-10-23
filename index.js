'use strict';
const defaultPort = 8000;
const tokenSecret = 'H`uP^.8y`_KIXU,C4)GYd\'`E"Y{6@pq0e.0J&v\'3.JIMk_T4dK4C)6x,5%xF9Ub';
const bcryptSalt = 10;

const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const sqlite3 = require("sqlite3");
const db = new sqlite3.Database(
    "database.db",
    sqlite3.OPEN_READWRITE,
    function (err) {
        if (err) {
            console.log("<Database> " + err.message);
            process.exit(0);
        }
        console.log("<Database> Database connected successfully.");
    }
);
const clientToken = new Map;
const clientRooms = new Map;
const roomList = [];

/* Table init */
db.run(`CREATE TABLE "Users" (
    "id" INTEGER,
    "username" TEXT,
    "passwd" TEXT,
    "salt" TEXT,
    PRIMARY KEY("id" AUTOINCREMENT)
);`, function (err) {
    console.log("<Database> Table 'Users' is " + (err ? "exisited" : "created") + ".");
});

/* Front-end */
app.use(express.urlencoded());
app.use(express.json());
app.use("/js", express.static("js"));
app.use("/css", express.static("css"));
app.use("/image", express.static("image"));
app.use("/bower_components", express.static("bower_components"));

app.get("/", function (req, res) {
    res.sendFile(__dirname + "/index.html");
});
app.get("/register", function (req, res) {
    res.sendFile(__dirname + "/register.html");
});
app.get("/login", function (req, res) {
    res.sendFile(__dirname + "/login.html");
});
app.get("/app", function (req, res) {
    res.sendFile(__dirname + "/app.html");
});

/* API */
app.post("/api/register", function (req, res) {
    const username = req.body.username;
    let passwd = req.body.passwd;
    db.all("SELECT id FROM Users WHERE username = ?", [username], function (err, rows) {
        if (err) {
            res.send({ state: 1, message: "An error occured. Please try again or contact the administrator." });
            console.log("<Database> Register: An error occured while quering username.");
            return;
        }
        if (rows.length > 0) {
            res.send({ state: 1, message: "The username has been registered." });
            return;
        }
        const salt = bcrypt.genSaltSync(bcryptSalt);
        passwd = bcrypt.hashSync(passwd, salt);
        db.run("INSERT INTO Users(username, passwd, salt) VALUES (?, ?, ?)", [username, passwd, salt], function (err) {
            if (err) {
                res.send({ state: 1, message: "An error occured. Please try again or contact the administrator." });
                console.log("<Database> Register: An error occured while inserting user data.");
                return;
            }
            res.send({ state: 0, message: "Your registration is done. Now you can log in." });
        });
    });
});
app.post("/api/login", function (req, res) {
    const username = req.body.username;
    let passwd = req.body.passwd;
    db.all("SELECT * FROM Users WHERE username = ?", [username], function (err, users) {
        if (err) {
            res.send({ state: 1, message: "An error occured. Please try again or contact the administrator." });
            console.log("<Database> Log in: An error occured while quering username.");
        }
        if (users.length === 0) {
            res.send({ state: 1, message: "The username has not been registered." });
            return;
        }
        passwd = bcrypt.hashSync(passwd, users[0].salt);
        if (passwd !== users[0].passwd) {
            res.send({ state: 1, message: "The password is not correct." });
            return;
        }
        const token = jwt.sign({
            id: users[0].id,
            username: users[0].username
        }, tokenSecret, { expiresIn: "1d" });
        clientToken.set(users[0].id, token);
        res.send({ state: 2, message: "Login successfully.", token: token });
    });
});
app.get("/api/logout", function (req, res) {
    const cookies = [];
    req.headers.cookie.split("; ").forEach(function (item) {
        cookies[item.substring(0, item.search("="))] = item.substring(item.search("=") + 1);
    });
    const decode = jwt.verify(cookies["token"], tokenSecret);
    if (clientToken.get(decode.id) === cookies["token"]) {
        clientToken.delete(decode.id);
        res.send({ state: 0, Message: "Log out successfully." });
    }
});

/* Socket */
io.on("connection", function (socket) {
    const auth = function () {
        if (!socket.handshake.headers.authorization) {
            socket.emit("op-ret", { state: 1, msg: "Authorization failed.", redirect: "login" });
            socket.disconnect();
            return false;
        }
        let decode, token = socket.handshake.headers.authorization.split(" ")[1];
        try {
            decode = jwt.verify(token, tokenSecret);
        }
        catch (e) {
            socket.emit("op-ret", { state: 1, msg: "Authorization failed.", redirect: "login" });
            socket.disconnect();
            return false;
        }
        if (clientToken.get(decode.id) !== token) {
            socket.emit("op-ret", { state: 1, msg: "Authorization failed.", redirect: "login" });
            socket.disconnect();
            return false;
        }
        return decode;
    };
    auth();
    socket.emit("room-list", roomList);
    socket.on("room-add", function (data) {
        if (!auth) return;
        const name = data.name;
        if (!name) {
            return;
        }
        roomList.push(name);
        socket.emit("op-ret", { state: 2, msg: "The room was created successfully." });
        io.emit("room-list", roomList);
    });
    socket.on("room-join", function (roomid) {
        const decode = auth();
        if (!decode) return;
        socket.join(roomid);
        console.log("<Room> Room " + roomid + ": User " + decode.username + " joined.");
        io.to(roomid).emit("message-receive", { type: 0, name: "System", message: decode.username + " joined the room." });
        clientRooms.set(decode.id, roomid);
    });
    socket.on("room-leave", function (roomid) {
        const decode = auth();
        if (!decode) return;
        socket.leave(roomid);
        console.log("<Room> Room " + roomid + ": User " + decode.username + " left.");
        io.to(roomid).emit("message-receive", { type: 0, name: "System", message: decode.username + " left the room." });
        clientRooms.delete(decode.id);
    });
    socket.on("message-send", function (data) {
        const decode = auth();
        if (!decode) return;
        if (clientRooms.has(decode.id)) {
            socket.to(clientRooms.get(decode.id)).emit("message-receive", { type: 2, name: decode.username, message: data.message });
            socket.emit("message-receive", { type: 1, name: decode.username, message: data.message });
        }
        else {
            socket.emit("op-ret", { state: 1, msg: "You did not join a room." });
        }
    });
});

server.listen(defaultPort, function () {
    console.log("<Server> Listening on port " + defaultPort);
});