const express = require("express");
const ytdl = require("ytdl-core");
const fs = require('fs');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
const ffmpeg = require('fluent-ffmpeg')
ffmpeg.setFfmpegPath(ffmpegPath)

const app = express();

app.use(express.json());
app.use(express.static("public"));


app.get("/",function(request,response){
	response.sendFile(__dirname + "public/index.html");
});

app.get("/videoInfo",async function(request,response){
	const videoURL = request.query.videoURL;
	const info = await ytdl.getInfo(videoURL);
	response.status(200).json(info);
});

app.get("/download",function(request,response){
	const videoURL = request.query.videoURL;
	const itag = request.query.itag;
	const format = request.query.format;
	response.header("Content-Disposition",'attachment;\ filename="video.'+format+'"');
	
	//due to mp4 weirdness this is the current solution read more at: https://github.com/fluent-ffmpeg/node-fluent-ffmpeg/issues/932
	// only readstreams can pipe to response but ffmpeg can't output a readStream

	// cut given youtube video and move to 'video_out.mp4' file
	// ytdl() returns readstream of youtube video 
	// then send to ffmpeg() to cut video into video_out.mp4
	ffmpeg(ytdl(videoURL,{
		filter: format => format.itag == itag
	}))
		.setStartTime('00:00:10') //start time of video (change to user input later)
		.setDuration('10') //duration of video (change to user input later)
		.output('video_out.mp4')
		.on('end', function(err) {
			if(!err) { console.log('conversion Done') }
			//take 'video_out.mp4' file and convert back into readstream
			var stream = fs.createReadStream('video_out.mp4');
			//pipe readstream
			stream.pipe(response);
		})
		.on('error', function(err){
			console.log('error: ', err)
		}).run()

	//tried to get ffmpeg to output to a readStream
	//errors with invalid arg

	// let inReadStream = ytdl(videoURL,{filter: format => format.itag == itag})
	// let outReadStream = ytdl(videoURL,{filter: format => format.itag == itag})
	// ffmpeg(inReadStream)
	// 	.setStartTime('00:00:10') //start time of video
	// 	.setDuration('10') //duration of video
	// 	.output(outReadStream)
	// 	.on('end', function(err) {
	// 		if(!err) { console.log('conversion Done') }
	// 		//pipe readstream
	// 		outReadStream.pipe(response);
	// 	})
	// 	.on('error', function(err){
	// 		console.log('error: ', err)
	// 	}).run()

	


});

const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`server started at ${port}`);
});