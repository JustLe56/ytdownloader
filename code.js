const express = require("express");
const ytdl = require("ytdl-core");
const fs = require('fs');
const { Readable } = require('stream');
var admZip = require("adm-zip");
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
const ffmpeg = require('fluent-ffmpeg');
const pathToFfmpeg = require('ffmpeg-static');
const ffprobe = require('ffprobe-static');
const AdmZip = require("adm-zip");
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

app.get("/download",async function(request,response){
	const videoURL = request.query.videoURL;
	const itag = request.query.itag;
	const format = request.query.format;
	var zip = new AdmZip();
	const info = await ytdl.getInfo(videoURL);

	response.header("Content-Disposition",'attachment;\ filename="video.'+format+'"');
	console.log(info.videoDetails.chapters.length-1)
	const numChapters = info.videoDetails.chapters.length-1;
	var i = 0;
	var conversionCount = 0;
	var downloadStream = ytdl(videoURL,{filter: format => format.itag == itag})
	console.log("All chapters: ")
	for (i = 0; i <= numChapters; i++){
		var currTitle = info.videoDetails.chapters[i].title;
		var currStartTime = info.videoDetails.chapters[i].start_time; //given in seconds aka 125 = 00:02:05
		if (i === numChapters){
			var nextStartTime = info.videoDetails.lengthSeconds;
		}
		else{
			var nextStartTime = info.videoDetails.chapters[i+1].start_time;
		}
		
		var duration = nextStartTime-currStartTime;
		var startTimeConv = new Date((currStartTime) * 1000).toISOString().substr(11, 8);

		console.log("Starting conversion for "+currTitle+" at: "+startTimeConv+ "to " +duration);
		ffmpeg(downloadStream)
			.setFfmpegPath(pathToFfmpeg)
      		.setFfprobePath(ffprobe.path)
			.setStartTime(startTimeConv) //start time of video (hh:mm:ss format)
			.setDuration(duration) //duration of video (seconds format)
			.withVideoCodec('copy')
      		.withAudioCodec('copy')
			.output('video_'+i+'.mp4')
			.on('end', function(err) {
				if(!err) { 
					console.log('Conversion finished ' +conversionCount+ "vs "+numChapters); //TODO: figure out better way of signalling to compress than checking every time
					
					//console.log(conversionCount+"vs "+numChapters);
					if (conversionCount === numChapters){
						for (var j = 0; j <= numChapters; j++){
							zip.addLocalFile("video_"+j+".mp4"); //TODO: change naming convention to use original chapter title
						}
						var zipFileContents = zip.toBuffer();
						
						//clean up local files
						for (var j = 0; j <= numChapters; j++){
							fs.unlink("video_"+j+".mp4", (err) =>{
								if(err)throw err;
								console.log("file deleted")
							})
						}

						const fileName = 'uploads.zip';
   						const fileType = 'application/zip';
						response.writeHead(200, {
							'Content-Disposition': `attachment; filename="${fileName}"`,
							'Content-Type': fileType,
						  })
						return response.end(zipFileContents)
					}
					conversionCount+=1;
				}
				
			})
			.on('error', function(err){
				console.log('error: ', err)
			}).run()
	}

});

const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`server started at ${port}`);
});
