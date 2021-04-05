'use strict';
const { Midi } = require('@tonejs/midi');
const { Frequency } = require('tone');
class Visualize {
    constructor(state, audioContext) {
        this.tracksSelect = document.getElementById('vTracks');
        this.canvas = document.getElementById('vCanvas');
        this.display = document.getElementById('vCanvasDisplay');
        this.prev = document.getElementById('vPrevFrame');
        this.next = document.getElementById('vNextFrame');
        this.current = document.getElementById('vCurrentFrame');
        this.cursor = document.querySelector('#visualizeTimeline .cursor');
        this.scrubbing = false;
        this.type = 'midi';
        this.fps = 24;
        this.frameLength = 1000 / this.fps;
        this.frame_h = 7.62;
        this.frameNumber = 0;
        this.width = 1920;
        this.height = 1080;
        this.samplerate = this.height * this.fps;
        this.displayWidth = 996;
        this.displayHeight = 560;
        this.trackNo = 0;
        this.tracksWithNotes = [];
        const visualizeState = {
            get: function () { return false; }
        };
        this.state = state;
        this.ctx = this.canvas.getContext('2d');
        this.displayCtx = this.display.getContext('2d');
        this.ctx.scale(1, 1);
        this.setFormat(this.width, this.height);
        this.sonify = new Sonify(visualizeState, this.canvas, audioContext);
        this.bindListeners();
    }
    bindListeners() {
        this.tracksSelect.addEventListener('change', this.changeTrack.bind(this));
        this.next.addEventListener('click', this.nextFrame.bind(this));
        this.prev.addEventListener('click', this.prevFrame.bind(this));
        this.current.addEventListener('change', this.editFrame.bind(this));
        this.cursor.addEventListener('mousedown', this.beginScrubbing.bind(this), false);
        document.addEventListener('mousemove', this.moveScrubbing.bind(this), false);
        document.addEventListener('mouseup', this.endScrubbing.bind(this), false);
    }
    set(filePath, type) {
        this.filePath = filePath;
        this.type = type;
        this.displayName = basename(filePath);
        return this.displayName;
    }
    clearTracks() {
        const length = this.tracksSelect.options.length;
        for (let i = length - 1; i >= 0; i--) {
            this.tracksSelect.options[i] = null;
        }
    }
    showTracks() {
        try {
            this.tracksSelect.classList.remove('hide');
        }
        catch (err) {
            //
        }
    }
    editFrame() {
        let frame = parseInt(this.current.value);
        if (frame < 0) {
            frame = 0;
        }
        if (frame > this.frames.length - 1) {
            frame = this.frames.length - 1;
        }
        this.displayFrame(frame);
    }
    async processMidi() {
        let midi;
        let trackStr;
        let track;
        try {
            midi = await Midi.fromUrl(this.filePath);
        }
        catch (err) {
            throw err;
        }
        this.tracksWithNotes = [];
        this.clearTracks();
        for (let i = 0; i < midi.tracks.length; i++) {
            track = midi.tracks[i];
            if (track.notes.length === 0) {
                continue;
            }
            this.tracksWithNotes.push(i);
            trackStr = `Track ${i + 1}, ${track.instrument.name} [${track.instrument.number}]`;
            this.tracksSelect.options[this.tracksSelect.options.length] = new Option(trackStr, String(this.tracksWithNotes.length - 1));
        }
        console.log(`${midi.name} has ${this.tracksWithNotes.length} tracks with notes`);
        this.showTracks();
    }
    changeTrack() {
        const val = this.tracksSelect.value;
        this.decodeMidi(parseInt(val));
    }
    async decodeMidi(trackIndex = 0) {
        let midi;
        let msMultiplier;
        let pitch;
        let ms;
        let notes = [];
        let frames = [];
        let note;
        let track;
        let lastNote = 0;
        let firstNote = -1;
        this.frameNumber = 0;
        this.trackNo = this.tracksWithNotes[trackIndex];
        this.frames = [];
        try {
            midi = await Midi.fromUrl(this.filePath);
        }
        catch (err) {
            throw err;
        }
        this.name = midi.name;
        console.log(this.name);
        console.log(`Decoding track ${this.trackNo}`);
        msMultiplier = (60000.0 / parseFloat(midi.header.tempos[0].bpm)) * 4.0;
        this.duration = midi.duration * 1000.0;
        this.durationTicks = midi.durationTicks;
        this.durationTick = midi.durationTicks / midi.duration;
        this.frameCount = Math.ceil(this.duration / this.frameLength);
        //this.frames = new Array(this.frameCount);
        this.frames = new Array();
        track = midi.tracks[this.trackNo];
        console.dir(track);
        if (track.notes.length === 0) {
            console.log('track does not contain any notes');
            return false;
        }
        console.log(`${track.notes.length} notes`);
        for (let midiNote of track.notes) {
            note = this.buildNote(this.trackNo, midiNote);
            notes.push(note);
        }
        for (let note of notes) {
            if (note.startFrame > this.frames.length - 1) {
                for (let i = 0; i < note.startFrame - this.frames.length; i++) {
                    this.frames.push(0);
                }
            }
            if (firstNote === -1) {
                firstNote = this.frames.length;
            }
            for (let i = 0; i < note.frames; i++) {
                this.frames.push(note.pitch);
            }
        }
        if (this.frames.length < this.frameCount) {
            for (let i = 0; i < this.frameCount - this.frames.length; i++) {
                this.frames.push(0);
            }
        }
        console.log(`${this.frames.length} vs. ${this.frameCount}`);
        this.displayFrame(firstNote);
    }
    buildNote(track, midiNote) {
        const pitch = Math.round(Frequency(midiNote.name) / this.fps);
        const ms = Math.round(1000.0 * parseFloat(midiNote.duration));
        const frameRaw = ms / this.frameLength;
        const frameCount = Math.round(frameRaw);
        const startFrame = Math.floor((midiNote.time * 1000.0) / this.frameLength);
        const note = {
            track,
            pitch,
            frames: frameCount,
            startFrame,
            ms
        };
        return note;
    }
    beginScrubbing() {
        this.scrubbing = true;
    }
    moveScrubbing(evt) {
        let cursor;
        let leftX;
        let width;
        if (this.scrubbing) {
            leftX = this.cursor.parentElement.offsetLeft;
            width = this.cursor.parentElement.clientWidth;
            cursor = ((evt.pageX - leftX) / width) * 100.0;
            if (cursor < 0) {
                cursor = 0;
            }
            else if (cursor > 100) {
                cursor = 100;
            }
            this.cursor.style.left = `${cursor}%`;
        }
    }
    endScrubbing() {
        let percent;
        let frame;
        if (this.scrubbing) {
            percent = parseFloat((this.cursor.style.left).replace('%', '')) / 100.0;
            frame = Math.floor(this.frames.length * percent);
            //snap to frame
            this.scrubbing = false;
            this.current.value = String(frame);
            this.displayFrame(frame);
        }
    }
    displayFrame(frameNumber) {
        const cursor = (frameNumber / this.frames.length) * 100.0;
        let lines;
        if (frameNumber < this.frames.length && typeof this.frames[frameNumber] !== 'undefined') {
            if (this.type === 'midi') {
                this.frameNumber = frameNumber;
                lines = this.frames[frameNumber];
                this.frameMidi(lines);
            }
        }
        this.current.value = String(frameNumber);
        this.cursor.style.left = `${cursor}%`;
    }
    nextFrame() {
        if (this.frameNumber < this.frames.length) {
            this.frameNumber++;
        }
        this.displayFrame(this.frameNumber);
    }
    prevFrame() {
        if (this.frameNumber > 0) {
            this.frameNumber--;
        }
        this.displayFrame(this.frameNumber);
    }
    frameMidi(lines) {
        const segment = this.height / lines;
        const thickness = Math.floor(segment / 2);
        let position;
        this.ctx.fillStyle = '#000000';
        this.ctx.strokeStyle = 'rgba(255,255,255,1.0)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        for (let i = 0; i < lines; i++) {
            position = (segment * (i + 0.5));
            this.ctx.lineWidth = thickness;
            this.ctx.beginPath();
            this.ctx.moveTo(0, position);
            this.ctx.lineTo(this.width, position);
            this.ctx.stroke();
        }
        this.displayCtx.drawImage(this.canvas, 0, 0, this.width, this.height, 0, 0, this.displayWidth, this.displayHeight);
    }
    setFormat(width, height) {
        this.width = width;
        this.height = height;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.display.width = this.displayWidth;
        this.display.height = this.displayHeight;
        this.state.set('vWidth', this.width);
        this.state.set('vHeight', this.height);
        this.samplerate = this.height * this.fps;
    }
}
//# sourceMappingURL=index.js.map