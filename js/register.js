$(function () {
    $("form").on("submit", function (event) {
        event.preventDefault();
        const formData = {};
        $(this).serializeArray().forEach(function (item) {
            formData[item["name"]] = item["value"];
        });
        if (formData["username"] === "") {
            $("#result-box").removeClass();
            $("#result-box").addClass("mb-3 alert alert-danger show");
            $("#result-box").text("Username cannot be empty.");
            $("#result-box").addClass("show");
            return;
        }
        if (formData["passwd"] === "") {
            $("#result-box").removeClass();
            $("#result-box").addClass("mb-3 alert alert-danger show");
            $("#result-box").text("Password cannot be empty.");
            $("#result-box").addClass("show");
            return;
        }
        formData["passwd"] = CryptoJS.HmacSHA256("data", formData["passwd"]).toString(CryptoJS.enc.Hex);
        $.ajax({
            type: "POST",
            url: "api/register",
            data: formData,
            dataType: "json",
            encode: true
        }).done(function (data) {
            if (data.state === 1) {
                $("#result-box").removeClass();
                $("#result-box").addClass("mb-3 alert alert-danger show");
                $("#result-box").text(data.message);
                $("#result-box").addClass("show");
                return;
            }
            $("#result-box").removeClass();
            $("#result-box").addClass("mb-3 alert alert-success show");
            $("#result-box").text(data.message);
        });
    });
});