'use strict';
$(function () {
    const socket = io({
        extraHeaders: {
            Authorization: "Bearer " + $.cookie("token")
        }
    });
    const Room = {
        current: -1,
        dom: [],
        add: function () {
            const name = $("#room-name").val();
            if (!name) {
                $("#result-box").removeClass();
                $("#result-box").addClass("mb-3 alert alert-danger show");
                $("#result-box").text("Name cannot be empty.");
            }
            socket.emit("room-add", { name: name });
        },
        join: function () {
            socket.emit("room-join", Room.current);
        },
        leave: function () {
            socket.emit("room-leave", Room.current);
        },
        list: function (rooms) {
            if (rooms.length === 0) {
                $("#content").html("<p class='no-rooms domList-item list-group-item disabled text-center'>No rooms.</p>");
                return;
            }
            for (let i = Room.dom.length; i < rooms.length; i++) {
                const roomDom = $("<p/>");
                roomDom.addClass("roomlist-item list-group-item d-flex flex-column justify-content-around");
                roomDom.data("roomid", i);
                roomDom.append($("<h4/>").addClass("room-name").text(rooms[i]));
                roomDom.on("click", function () {
                    if (Room.current != -1) {
                        Room.dom[Room.current].removeClass("active");
                        socket.emit("room-leave", Room.current);
                        $("#room-content").empty();
                    }
                    Room.current = $(this).data("roomid");
                    Room.dom[Room.current].addClass("active");
                    Room.join();
                    $("#app").addClass("sidebar-hide");
                });
                if (rooms[i].lastText) {
                    roomDom.append($("<span/>").addClass("room-last-text").text(rooms[i].lastText));
                }
                Room.dom[i] = roomDom;
                $("#content").append(roomDom);
            }
        },
        send: function () {
            const text = $("#input-bar").val();
            if (text !== "") {
                socket.emit("message-send", { message: text });
            }
            $("#input-bar").val("");
        },
        receive: function (data) {
            const messageType = ["system", "self", "others"];
            const messageDom = $("<div/>").addClass("message message-" + messageType[data.type]);
            const messageName = $("<p/>").addClass("message-name");
            const messageContent = $("<p/>").addClass("message-content");
            messageName.text(data.name);
            messageContent.text(data.message);
            messageDom.append([messageName, messageContent]);
            $("#room-content").append(messageDom);
            $("#room-content").parent().scrollTop($("#room-content").parent()[0].scrollHeight);
        }
    };
    socket.emit("room-list");
    socket.on("op-ret", (json) => { notification(json) });
    socket.on("room-list", (rooms) => { Room.list(rooms) });
    socket.on("message-receive", (data) => { Room.receive(data) });
    socket.on("disconnect", () => { notification({ state: 1, msg: "Disconnected from server.", redirect: "login" }) });
    $(window).on("beforeunload", Room.leave);
    $("#add-room-send").on("click", Room.add);
    $("#send-message").on("click", Room.send);
    $("#sidebar-menu").on("click", () => { $("#app").toggleClass("sidebar-hide") });
});

function notification(json) {
    $('.modal').modal('hide');
    const notiModal = new bootstrap.Modal(document.getElementById("notification"));
    const classType = ["light", "danger", "success"];
    $("#noti-content").text(json.msg).removeClass().addClass("m-3 alert alert-" + classType[json.state]);
    notiModal.show();
    if (json.redirect) {
        $("#notification").on("hidden.bs.modal", function (event) {
            location.href = json.redirect;
        });
    }
}