require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const PORT = process.env.PORT || 3100;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Check if the folder exists
if (!fs.existsSync(uploadsPath)) {
  // Create the folder
  fs.mkdirSync(uploadsPath, { recursive: true });
  console.log('Uploads folder created successfully!');
} else {
  console.log('Uploads folder already exists.');
}

// Store streams per file
const uploads = {};

// --- Route to get uploaded file list ---
app.get('/files', (req, res) => {
    const uploadPath = path.join(__dirname, 'uploads');
    fs.readdir(uploadPath, (err, files) => {
    if (err) return res.status(500).json({ error: 'Unable to list files' });
    const validFiles = files.filter(file => {
        const stats = fs.statSync(path.join(uploadPath, file));
        return stats.size > 0;
    });
    res.json({ files: validFiles });
});
});

io.on('connection', (socket) => {
    console.log('A user connected');

    // Map to store active file streams per upload
    const uploads = {};

    socket.on('start-upload', (data) => {
        const { fileName } = data;
        const savePath = path.join(__dirname, 'uploads', fileName);

        // Create a new file stream for this upload
        uploads[fileName] = fs.createWriteStream(savePath);
        console.log(`Starting upload: ${fileName}`);
    });


    socket.on('upload-chunk', (data) => {
        if (!data || !data.fileName || !data.chunk) return;
        if (uploads[data.fileName]) {
            uploads[data.fileName].write(Buffer.from(data.chunk));
        }
    });


    socket.on('end-upload', (data) => {
        //console.log(data)
        if (!data || !data.fileName) return; // ignore bad data
        const { fileName } = data;
        if (uploads[fileName]) {
            uploads[fileName].end(() => {
                console.log(`File http://localhost:3100/uploads/${fileName} saved successfully.`);
                socket.emit('upload-complete', { fileName });
            });
            delete uploads[fileName];
        }
    });


    socket.on('disconnect', () => {
        console.log('User disconnected');
        // Remove partial files
        for (const fileName in uploads) {
            const upload = uploads[fileName];
            if (upload.stream) {
                upload.stream.end();
                if (!upload.started) continue; // No file created
                fs.unlink(upload.path, (err) => {
                    if (!err) console.log(`Deleted incomplete file: ${fileName}`);
                });
            }
            delete uploads[fileName];
        }
    });
});

app.get("/",(req,res)=>{
    res.sendFile(path.join(__dirname,"/public/index.html"))
})
app.get("/single",(req,res)=>{
    res.sendFile(path.join(__dirname,"/public/single.html"))
})
app.get("/galery",(req,res)=>{
    res.sendFile(path.join(__dirname,"/public/galery.html"))
})

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

