'use strict';

import { StatsBase } from "fs-extra";

class Overlay {
    private elem : HTMLElement = document.getElementById('overlay');
    private msg : HTMLElement = document.getElementById('overlayMsg');
    private progressBar : HTMLElement = document.getElementById('overlayProgressBar');
    private progressMsg : HTMLElement = document.getElementById('overlayProgressMsg');
    constructor () {

    }
    public show (msg : string = '') {
        showSpinner('overlaySpinner');
        this.msg.innerText = msg;
        this.elem.classList.add('show');
    }
    
    public hide () {
        try {
            this.elem.classList.remove('show');
        } catch (err) {
            console.error(err);
        }
        this.msg.innerText = '';
        hideSpinner('overlaySpinner');
    }

    public progress (percent : number, msg : string) {
        this.progressMsg.innerText = msg;
        this.progressBar.style.width = `${percent * 100}%`;
    }
}

export default class UI {
    private state : State;

    private startSelect : HTMLElement = document.getElementById('startSelect');
    private endSelect : HTMLElement = document.getElementById('endSelect');
    private startDisplay : HTMLElement = this.startSelect.querySelector('.after');
    private endDisplay : HTMLElement = this.endSelect.querySelector('.after');
    private theatre : HTMLElement = document.getElementById('theatre');

    private endMoving : boolean = false;
    private startMoving : boolean = false;

    private width : number = 1280;
    private height : number = 720;

    private min : number = 0;
    private max : number = 996;

    private theatreHeight : number;
    private theatreWidth : number;

    private start : number = 0.81;
    private end : number = 1.0;

    public onSelectionChange : Function;
    public overlay : Overlay;

    public currentPage : string = 'sonify';

    constructor (state : State) {
        this.state = state;

        this.overlay = new Overlay();

        this.startSelect.addEventListener('mousedown', this.beginMoveStart.bind(this), false);
        this.endSelect.addEventListener('mousedown', this.beginMoveEnd.bind(this), false);

        document.addEventListener('mousemove', this.moveStart.bind(this), false);
        document.addEventListener('mousemove', this.moveEnd.bind(this), false);
        document.addEventListener('mouseup', this.endMoveStart.bind(this), false);
        document.addEventListener('mouseup', this.endMoveEnd.bind(this), false);

        this.theatreHeight = this.theatre.offsetHeight;
        this.theatreWidth = this.theatre.offsetWidth;
    }

    private beginMoveStart (evt: MouseEvent) {
        this.startMoving = true;
        this.startSelect.classList.add('active');
    }

    private endMoveStart (evt: MouseEvent) {
        const scale : number = this.height / this.theatreHeight;
        const scaledWidth : number = this.width / scale;
        const start : number = (this.startSelect.offsetLeft - this.min) / scaledWidth;

        if (this.startMoving) {
            this.startMoving = false;
            try {
                this.startSelect.classList.remove('active');
            } catch (err) {
                //
            }

            this.start = start;
            this.state.set('start', start);
            if (this.onSelectionChange) this.onSelectionChange();
        }
    }

    private moveStart (evt : MouseEvent) {
        let width : number;
        let leftX : number;
        let newLeftX : number;
        let maxX : number;
        let ratio : number;
        let scale : number;
        let scaledWidth : number;
        let percent : string;

        if (this.startMoving) {
            width = this.theatre.clientWidth;
            leftX = this.theatre.offsetLeft;

            maxX = this.endSelect.offsetLeft - 1;
            newLeftX = evt.pageX - leftX;

            if (newLeftX <= this.min) {
                newLeftX = this.min;
            }

            if (newLeftX >= maxX) {
                newLeftX = maxX;
            }

            ratio = newLeftX / width;
            this.startSelect.style.left = `${ratio * 100}%`;
            this.startDisplay.innerText = `${Math.floor(ratio * 100)}%`;

            scale = this.height / this.theatreHeight;
            scaledWidth = this.width / scale;
            percent = Math.round( ((this.startSelect.offsetLeft - this.min) / scaledWidth) * 100) + '%';
        }
    }

    private beginMoveEnd (evt: MouseEvent) {
        this.endMoving = true;
        this.endSelect.classList.add('active');
    }

    private endMoveEnd (evt: MouseEvent) {
        const scale : number = this.height / this.theatreHeight;
        const scaledWidth : number = this.width / scale;
        const end : number = (this.endSelect.offsetLeft - this.min) / scaledWidth;
        if (this.endMoving) {
            this.endMoving = false;
            try {
                this.endSelect.classList.remove('active');
            } catch (err) {
                //
            }
        
            this.end = end;
            this.state.set('end', end);
            if (this.onSelectionChange) this.onSelectionChange();
        }
    }

    private moveEnd (evt : MouseEvent) {
        let width : number;
        let leftX : number;
        let newLeftX : number;
        let minX : number;
        let ratio : number;
        let scale : number;
        let scaledWidth : number;
        let percent : string;

        if (this.endMoving) {
            width = this.theatre.clientWidth;
            leftX = this.theatre.offsetLeft;
            
            minX = this.startSelect.offsetLeft + 1;
            newLeftX = evt.pageX - leftX;

            if (newLeftX <= minX) {
                newLeftX = minX;
            }

            if (newLeftX >= this.max) {
                newLeftX = this.max;
            }

            ratio = newLeftX / width;
            this.endSelect.style.left = `${ratio * 100}%`;
            this.endDisplay.innerText = `${Math.floor(ratio * 100)}%`;

            scale = this.height / this.theatreHeight;
            scaledWidth = this.width / scale;
            percent = Math.round( ((this.endSelect.offsetLeft - this.min) / scaledWidth) * 100) + '%';
        }
    }

    public updateSliders (width : number, height : number) {
        let ratio : number;
        let scale : number;
        let scaledWidth : number;
        
        this.start = this.state.get('start');
        this.end = this.state.get('end');

        this.width = width;
        this.height = height;

        scale = this.height / this.theatreHeight;
        scaledWidth = this.width / scale;
        
        this.min = Math.round((this.theatreWidth - scaledWidth) / 2);
        this.max = this.min + Math.round(scaledWidth);


        ratio = (this.min + (scaledWidth * this.start)) / this.theatreWidth;
        if (ratio < 0) {
            ratio = 0;
        }
        this.startSelect.style.left = `${ratio * 100}%`;

        ratio = (this.min + (scaledWidth * this.end)) / this.theatreWidth;
        if (ratio > 1) {
            ratio = 1;
        }
        this.endSelect.style.left = `${ratio * 100}%`;
    }

    public removeClass (selector : string, className : string) {
        document.querySelectorAll(selector).forEach((page : HTMLElement) => {
            if (page.classList.contains(className)) {
                page.classList.remove(className);
            }
        });
    }

    public page (name : string) {
        const btnElement : HTMLElement = document.querySelector(`#${name}Btn`);
        const targetElement : HTMLElement = document.querySelector(`#${name}`);

        if ( !btnElement.classList.contains('active') ) {
            this.removeClass('.pageBtn', 'active');
            btnElement.classList.add('active');
        }
        if ( !targetElement.classList.contains('show') ) {
            this.removeClass('.page', 'show');
            targetElement.classList.add('show');
            this.state.set('page', name);
        }
        
        this.currentPage = name;
    }
}