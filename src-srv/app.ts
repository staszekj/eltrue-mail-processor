import express from "express";
import {getNewToken, handleMessage, listMessages} from "./gmail"

const app = express();
app.get("/", (req, res) => {
    res.send("Hello World");
});

const PORT = process.env.PORT || 3000;

// app.listen(PORT, () => {
//     console.log(`Server is running in http://localhost:${PORT}`);
// });


listMessages();

//getMessage("16eb845b2f21567a");

//getNewToken();
