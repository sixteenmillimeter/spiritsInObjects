'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.ffmpeg = void 0;
const child_process_1 = require("child_process");
const os_1 = require("os");
const path_1 = require("path");
const fs_extra_1 = require("fs-extra");
const crypto_1 = require("crypto");
const spawnAsync_1 = require("../spawnAsync");
const bin = require('ffmpeg-static');
const ffprobe = require('ffprobe-static').path;
let tmp;
class ffmpeg {
    static async info(filePath) {
        const args = [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            filePath
        ];
        let res;
        try {
            res = await spawnAsync_1.spawnAsync(ffprobe, args);
        }
        catch (err) {
            console.error(err);
        }
        //console.dir(JSON.parse(res.stdout));
        return JSON.parse(res.stdout);
    }
    static hash(data) {
        return crypto_1.createHash('sha1').update(data).digest('hex');
    }
    static parseStderr(line) {
        //frame= 6416 fps= 30 q=31.0 size=   10251kB time=00:03:34.32 bitrate= 391.8kbits/s speed=   1x
        let obj = {};
        if (line.substring(0, 'frame='.length) === 'frame=') {
            try {
                obj.frame = line.split('frame=')[1].split('fps=')[0];
                obj.frame = parseInt(obj.frame);
                obj.fps = line.split('fps=')[1].split('q=')[0];
                obj.fps = parseFloat(obj.fps);
                obj.time = line.split('time=')[1].split('bitrate=')[0];
                obj.speed = line.split('speed=')[1].trim().replace('x', '');
                obj.speed = parseFloat(obj.speed);
                obj.size = line.split('size=')[1].split('time=')[0].trim();
            }
            catch (err) {
                console.error(err);
                console.log(line);
                process.exit(1);
            }
        }
        else {
        }
        return obj;
    }
    static async exportPath() {
        tmp = path_1.join(os_1.tmpdir(), 'sio');
        try {
            await fs_extra_1.unlink(tmp);
        }
        catch (err) {
            //
        }
        try {
            await fs_extra_1.mkdir(tmp);
        }
        catch (err) {
            //
        }
        return tmp;
    }
    static async exportFrames(filePath, onProgress = () => { }) {
        const hash = this.hash(filePath);
        const input = {};
        const output = path_1.join(tmp, `${hash}-export-%08d.png`);
        const args = [
            '-i', filePath,
            '-compression_algo', 'raw',
            '-pix_fmt', 'rgb24',
            '-crf', '0',
            '-y',
            output
        ];
        console.log(`${bin} ${args.join(' ')}`);
        return new Promise((resolve, reject) => {
            const child = child_process_1.spawn(bin, args);
            let stdout = '';
            let stderr = '';
            child.on('exit', (code) => {
                if (code === 0) {
                    return resolve(tmp);
                }
                else {
                    console.error(`Process exited with code: ${code}`);
                    console.error(stderr);
                    return reject(stderr);
                }
            });
            child.stdout.on('data', (data) => {
                stdout += data;
            });
            child.stderr.on('data', (data) => {
                const line = data.toString();
                const obj = this.parseStderr(line);
                let estimated;
                if (obj.frame) {
                    onProgress(obj);
                }
            });
            return child;
        });
    }
    static exportFramePath(hash, frameNum) {
        const padded = `${frameNum}`.padStart(8, '0');
        return path_1.join(tmp, `${hash}-export-${padded}.png`);
    }
    /**
     * Export a single frame from a video.
     *
     * @param filePath
     * @param frameNum
     */
    static async exportFrame(filePath, frameNum) {
        const padded = `${frameNum}`.padStart(8, '0');
        const hash = this.hash(filePath);
        const output = path_1.join(tmp, `${hash}-export-${padded}.png`);
        const args = [
            '-i', filePath,
            '-vf', `select='gte(n\\,${frameNum})'`,
            '-vframes', '1',
            '-compression_algo', 'raw',
            '-pix_fmt', 'rgb24',
            '-crf', '0',
            '-y',
            output
        ];
        let res;
        try {
            res = await spawnAsync_1.spawnAsync(bin, args);
        }
        catch (err) {
            throw err;
        }
        return output;
    }
    static async exportVideo(inputPath, outputPath, format = 'prores3', onProgress = () => { }) {
        const args = [
            '-f', 'image2',
            '-i', inputPath,
            '-r', '24'
        ];
        if (format === 'prores3') {
            args.push('-c:v');
            args.push('prores_ks');
            args.push('-profile:v');
            args.push('3');
        }
        else if (format === 'h264') {
            args.push('-c:v');
            args.push('libx264');
            args.push('-preset');
            args.push('slow');
            args.push('-crf');
            args.push('5');
        }
        args.push('-y');
        args.push(outputPath);
        console.log(`${bin} ${args.join(' ')}`);
        return new Promise((resolve, reject) => {
            const child = child_process_1.spawn(bin, args);
            let stdout = '';
            let stderr = '';
            child.on('exit', (code) => {
                if (code === 0) {
                    return resolve(tmp);
                }
                else {
                    console.error(`Process exited with code: ${code}`);
                    console.error(stderr);
                    return reject(stderr);
                }
            });
            child.stdout.on('data', (data) => {
                stdout += data;
            });
            child.stderr.on('data', (data) => {
                const line = data.toString();
                const obj = this.parseStderr(line);
                let estimated;
                if (obj.frame) {
                    onProgress(obj);
                }
            });
            return child;
        });
    }
    static async resampleAudio(input, output, sampleRate, channels, onProgress = () => { }) {
        const args = [
            '-i', input,
            //mix to mono however many channels provided
            '-ac', '1',
            //resample
            '-ar', `${sampleRate}`,
            output
        ];
        console.log(`${bin} ${args.join(' ')}`);
        return new Promise((resolve, reject) => {
            const child = child_process_1.spawn(bin, args);
            let stdout = '';
            let stderr = '';
            child.on('exit', (code) => {
                if (code === 0) {
                    return resolve(output);
                }
                else {
                    console.error(`Process exited with code: ${code}`);
                    console.error(stderr);
                    return reject(stderr);
                }
            });
            child.stdout.on('data', (data) => {
                stdout += data;
            });
            child.stderr.on('data', (data) => {
                const line = data.toString();
                const obj = this.parseStderr(line);
                let estimated;
                if (obj.frame) {
                    onProgress(obj);
                }
            });
            return child;
        });
    }
    static async exportPreview(inputPath, outputPath, onProgress = () => { }) {
        const args = [
            '-i', inputPath,
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '18',
            '-y',
            outputPath
        ];
        let res;
        console.log(`${bin} ${args.join(' ')}`);
        return new Promise((resolve, reject) => {
            const child = child_process_1.spawn(bin, args);
            let stdout = '';
            let stderr = '';
            child.on('exit', (code) => {
                if (code === 0) {
                    return resolve(tmp);
                }
                else {
                    console.error(`Process exited with code: ${code}`);
                    console.error(stderr);
                    return reject(stderr);
                }
            });
            child.stdout.on('data', (data) => {
                stdout += data;
            });
            child.stderr.on('data', (data) => {
                const line = data.toString();
                const obj = this.parseStderr(line);
                let estimated;
                if (obj.frame) {
                    onProgress(obj);
                }
            });
            return child;
        });
    }
}
exports.ffmpeg = ffmpeg;
module.exports.ffmpeg = ffmpeg;
//# sourceMappingURL=index.js.map