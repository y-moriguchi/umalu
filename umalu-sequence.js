/**
 * umalu
 *
 * Copyright (c) 2018 Yuichiro MORIGUCHI
 *
 * This software is released under the MIT License.
 * http://opensource.org/licenses/mit-license.php
 **/
(function() {
	var global = Function("return this")(),
		states = {},
		drawer,
		DIRECTION_UP = 0,
		DIRECTION_RIGHT = 1,
		DIRECTION_DOWN = 2,
		DIRECTION_LEFT = 3,
		LABEL_CORNER = /[\+]/,
		LABEL_BOUND = /[\|\-]/,
		MESSAGE_TEXT = /[^\s\-]/,
		defaultOptions,
		opt,
		fragments = [],
		fragmentId = 10000,
		noteId = 20000;
	defaultOptions = {
		greekBytes: 2,
		mathBytes: 2,
		debuglog: console.log,
		iteration: 20000,
		scriptType: "text/x-umalu-sequence",
		boxMargin: 15,
		fontFamily: "sans-serif",
		stroke: "#B0193D",
		fill: "#FEFDD2",
		strokeDasharray: 5,
		arrowMargin: 10,
		arrowSize: 6,
		fragmentMargin: 8,
		fragmentNestMargin: 4,
		fragmentFill: "#BBBBBB",
		noteSize: 8
	};
	opt = defaultOptions;
	function extend(base, extension) {
		var i, res = {};
		for(i in base) {
			if(base.hasOwnProperty(i)) {
				res[i] = base[i];
			}
		}
		for(i in extension) {
			if(extension.hasOwnProperty(i)) {
				res[i] = extension[i];
			}
		}
		return res;
	}
	function trim(string) {
		return string.replace(/^\s+|\s+$/g, "");
	}
	function max() {
		var i,
			res;
		for(i = 0; i < arguments.length; i++) {
			if(i > 0) {
				res = res < arguments[i] ? arguments[i] : res;
			} else {
				res = arguments[i];
			}
		}
		return res;
	}
	function bind(func) {
		var args = Array.prototype.slice.call(arguments, 1);
		return function() {
			return func.apply(null, args);
		};
	}
	function engine(quadro, initState) {
		var state = initState,
			i;
		for(i = 0; (state = state(quadro)) !== null; i++) {
			// writes log
			opt.debuglog(state.name + ":" + quadro.getChar() + "(" + quadro._x + "," + quadro._y + ")");
			if(i > opt.iteration) {
				throw new Error("Parse Error: Infinite Loop");
			}
		}
	}
	function Cell(aString) {
		this._char = aString.charCodeAt(0);
		this._string = aString;
		this.markActorNumber = 0;
		this.markLiveBar = false;
		this.markTextStart = false;
		this.markFragment = 0;
		this.markFragmentEnd = 0;
		this.markNote = 0;
		this.markNoteLeft = 0;
		this.markNoteEnd = 0;
		this.markInvalid = false;
		this.markSelfPos = false;
		this.markTextRead = false;
	}
	Cell.prototype.getChar = function() {
		return this._string;
	};
	Cell.prototype.getCharCode = function() {
		return this._char;
	};
	function Quadro(input) {
		var split,
			i,
			j;
		this._quadro = [];
		this._x = 0;
		this._y = 0;
		this._direction = DIRECTION_UP;
		this._positionStack = [];
		this.actorNumber = 0;
		this.actors = [];
		this.callFrom = null;
		this.messageArrows = [];
		this.messageArrowsList = [];
		this.messageText = "";
		this.drawer = null;
		this.canvas = null;
		this.scanActor = 0;
		this.notes = [];
		split = input.split(/\r?\n/);
		this._xBound = 0;
		this._yBound = split.length;
		for(i = 0; i < split.length; i++) {
			this._xBound = this._xBound < split[i].length ? split[i].length : this._xBound;
		}
		for(i = 0; i < split.length; i++) {
			this._quadro.push([]);
			for(j = 0; j < this._xBound; j++) {
				if(j < split[i].length) {
					this._quadro[i].push(new Cell(split[i].charAt(j)));
				} else {
					this._quadro[i].push(new Cell(" "));
				}
			}
		}
	}
	Quadro.prototype.getDirection = function() {
		return this._direction;
	};
	Quadro.prototype.up = function() {
		this._y = this._y < 0 ? this._y : this._y - 1;
		return this;
	};
	Quadro.prototype.down = function() {
		this._y = this._y > this._yBound ? this._y : this._y + 1;
		return this;
	};
	Quadro.prototype.left = function() {
		this._x = this._x < 0 ? this._x : this._x - 1;
		return this;
	};
	Quadro.prototype.right = function() {
		this._x = this._x > this._xBound ? this._x : this._x + 1;
		return this;
	};
	Quadro.prototype.cr = function() {
		this._x = 0;
		return this;
	};
	Quadro.prototype.home = function() {
		this._x = this._y = 0;
		return this;
	};
	Quadro.prototype.turnLeft = function() {
		this._direction--;
		if(this._direction < 0) {
			this._direction = DIRECTION_LEFT;
		}
		return this;
	};
	Quadro.prototype.turnRight = function() {
		this._direction++;
		if(this._direction > DIRECTION_LEFT) {
			this._direction = DIRECTION_UP;
		}
		return this;
	};
	Quadro.prototype.forward = function() {
		switch(this._direction) {
		case DIRECTION_UP:     return this.up();
		case DIRECTION_RIGHT:  return this.right();
		case DIRECTION_DOWN:   return this.down();
		case DIRECTION_LEFT:   return this.left();
		}
	};
	Quadro.prototype.back = function() {
		switch(this._direction) {
		case DIRECTION_UP:     return this.down();
		case DIRECTION_RIGHT:  return this.left();
		case DIRECTION_DOWN:   return this.up();
		case DIRECTION_LEFT:   return this.right();
		}
	};
	Quadro.prototype.isInBound = function(x, y) {
		var cmpx = (x === void(0)) ? this._x : x,
			cmpy = (y === void(0)) ? this._y : y;
		return cmpx >= 0 && cmpx < this._xBound && cmpy >= 0 && cmpy < this._yBound;
	};
	Quadro.prototype.checkInBound = function(x, y) {
		if(!this.isInBound(x, y)) {
			throw new Error("Parse Error");
		}
	};
	Quadro.prototype.getDirectionXY = function(direction) {
		var x = this._x,
			y = this._y,
			dir = this._direction,
			i;
		function forward(dir) {
			switch(dir % 4) {
			case DIRECTION_UP:     y--;  break;
			case DIRECTION_RIGHT:  x++;  break;
			case DIRECTION_DOWN:   y++;  break;
			case DIRECTION_LEFT:   x--;  break;
			}
		}
		if(direction) {
			for(i = 0; i < direction.length; i++) {
				switch(direction.charAt(i)) {
				case 'u':  y--;  break;
				case 'd':  y++;  break;
				case 'l':  x--;  break;
				case 'r':  x++;  break;
				case 'f':  forward(dir);      break;
				case 'b':  forward(dir + 2);  break;
				case 'L':
					dir = dir > 0 ? dir - 1 : DIRECTION_LEFT;
					break;
				case 'R':
					dir = dir < DIRECTION_LEFT ? dir + 1 : DIRECTION_UP;
					break;
				}
			}
		}
		return {
			x: x,
			y: y
		};
	};
	Quadro.prototype.getPosX = function() {
		return this._x;
	};
	Quadro.prototype.getPosY = function() {
		return this._y;
	};
	Quadro.prototype.getPropByPos = function(name, x, y) {
		return this.isInBound(x, y) ? this._quadro[y][x][name] : null;
	};
	Quadro.prototype.getCharByPos = function(x, y) {
		return this.isInBound(x, y) ? this._quadro[y][x].getChar() : '\u0000';
	};
	Quadro.prototype.getChar = function(direction) {
		var xy = this.getDirectionXY(direction);
		return this.isInBound(xy.x, xy.y) ? this._quadro[xy.y][xy.x].getChar() : '\u0000';
	};
	Quadro.prototype.setProp = function(name, value, direction) {
		var xy = this.getDirectionXY(direction);
		if(this.isInBound(xy.x, xy.y)) {
			this._quadro[xy.y][xy.x][name] = value;
		}
		return this;
	};
	Quadro.prototype.getProp = function(name, direction) {
		var xy = this.getDirectionXY(direction);
		return this.isInBound(xy.x, xy.y) ? this._quadro[xy.y][xy.x][name] : null;
	};
	Quadro.prototype.check = function(chset, direction) {
		if(typeof chset === "string" && chset.length === 1) {
			return this.getChar(direction) === chset;
		} else {
			return chset.test(this.getChar(direction));
		}
	};
	function repeatWhileUntil(cond) {
		return function(condition, direction, action) {
			var me = this,
				xy,
				check;
			if(typeof condition === "function") {
				check = condition;
			} else {
				check = function() {
					return me.check(condition);
				}
			}
			while(!!check(me._quadro[me._y][me._x]) === cond) {
				action(me._quadro[me._y][me._x]);
				xy = me.getDirectionXY(direction);
				if(!me.isInBound(xy.x, xy.y)) {
					throw new Error("Parse Error");
				}
				me._x = xy.x;
				me._y = xy.y;
			}
			return me;
		}
	}
	Quadro.prototype.repeatUntil = repeatWhileUntil(false);
	Quadro.prototype.repeatWhile = repeatWhileUntil(true);
	Quadro.prototype.pushPosition = function(state, move) {
		this._positionStack.push({
			x: this._x,
			y: this._y,
			state: state,
			move: move
		});
	};
	Quadro.prototype.returnPosition = function() {
		var pos = this._positionStack.pop(),
			move;
		this._x = pos.x;
		this._y = pos.y;
		move = this.getDirectionXY(pos.move);
		this._x = move.x;
		this._y = move.y;
		return pos.state;
	};
	states.init = function init(quadro) {
		return states.scanLabelCorner;
	};
	function isFragment(quadro) {
		var x = quadro.getPosX() + 1,
			y = quadro.getPosY(),
			slash = false;
		for(; quadro.getCharByPos(x, y) === "-"; x++) {
			if(!slash && quadro.getCharByPos(x, y + 1) === "/") {
				slash = true;
			} else if(slash && quadro.getPropByPos("markLiveBar", x, y)) {
				return true;
			}
		}
		return false;
	}
	function isNote(quadro) {
		var x = quadro.getPosX() + 1,
			y = quadro.getPosY();
		for(; true; x++) {
			if(quadro.getCharByPos(x, y + 1) === "|" &&
					quadro.getCharByPos(x + 1, y + 1) === "\\") {
				return true;
			} else if(quadro.getCharByPos(x, y) !== "-") {
				return false;
			}
		}
	}
	states.scanLabelCorner = function scanLabelCorner(quadro) {
		if(quadro.check(LABEL_CORNER) &&
				quadro.check("|", "d") &&
				quadro.check("-", "r") &&
				!quadro.getProp("markActorNumber") &&
				!isFragment(quadro) &&
				!isNote(quadro)) {
			quadro.pushPosition(states.scanLabelCorner, "r");
			return states.actorInit;
		} else if(quadro.isInBound()) {
			quadro.right();
			return states.scanLabelCorner;
		} else {
			quadro.cr().down();
			if(quadro.isInBound()) {
				return states.scanLabelCorner;
			} else {
				quadro.home();
				return states.scanMessage;
			}
		}
	};
	states.scanMessage = function scanMessage(quadro) {
		if(quadro.getProp("markLiveBar") &&
				!quadro.getProp("markFragment") &&
				!quadro.getProp("markNote") &&
				!quadro.getProp("markInvalid") &&
				quadro.check("-", "r")) {
			quadro.callFrom = quadro.getProp("markActorNumber");
			quadro.right();
			return states.scanArrow;
		} else if(quadro.getProp("markLiveBar") &&
				!quadro.getProp("markFragment") &&
				!quadro.getProp("markNote") &&
				!quadro.getProp("markInvalid") &&
				quadro.check("<", "r")) {
			quadro.callFrom = quadro.getProp("markActorNumber");
			quadro.right();
			return states.scanResponse;
		} else if(quadro.check(LABEL_CORNER) &&
				!quadro.getProp("markActorNumber") &&
				isFragment(quadro)) {
			quadro.messageArrows.push(new FragmentStart(quadro.scanActor + 1));
			quadro.setProp("markFragment", fragmentId);
			return states.scanFragment;
		} else if(quadro.check(LABEL_CORNER) &&
				!quadro.getProp("markActorNumber") &&
				isNote(quadro)) {
			quadro.setProp("markNote", noteId);
			quadro.pushPosition(states.scanMessage, "r");
			return states.scanNote;
		} else if(quadro.getProp("markFragmentEnd")) {
			quadro.messageArrows.push(new FragmentEnd(quadro.getProp("markFragmentEnd")));
			quadro.right();
			return states.scanMessage;
		} else if(quadro.getProp("markNoteLeft") &&
				quadro.messageArrows[quadro.messageArrows.length - 1] instanceof Message) {
			quadro.messageArrows.push(quadro.notes[quadro.getProp("markNote")]);
			quadro.pushPosition(states.scanMessage, "r");
			return states.resetMarkNoteLeft;
		} else if(quadro.isInBound()) {
			if(quadro.getProp("markActorNumber")) {
				quadro.scanActor = quadro.getProp("markActorNumber");
			}
			quadro.right();
			return states.scanMessage;
		} else {
			quadro.cr().down();
			quadro.scanActor = 0;
			if(quadro.messageArrows.length > 0) {
				quadro.messageArrowsList.push(quadro.messageArrows);
				quadro.messageArrows = [];
			}
			if(quadro.isInBound()) {
				return states.scanMessage;
			} else {
				quadro.drawer(quadro);
				return null;  // accepted
			}
		}
	};
	states.scanFragment = function scanFragment(quadro) {
		var scanActor = quadro.scanActor,
			textState = "INIT",
			spaceFlag = false;
		quadro.right();
		quadro.repeatWhile("-", "r", function(cell) {
			cell.markFragment = fragmentId;
			if(cell.markActorNumber) {
				scanActor = cell.markActorNumber;
			}
		});
		quadro.setProp("markFragment", fragmentId);
		quadro.messageArrows[quadro.messageArrows.length - 1].endX = scanActor + 1;
		quadro.down();
		quadro.repeatWhile("|", "d", function(cell) {
			cell.markFragment = fragmentId;
		});
		quadro.setProp("markFragment", fragmentId);
		quadro.left();
		quadro.repeatWhile("-", "l", function(cell) {
			cell.markFragment = fragmentId;
		});
		quadro.setProp("markFragment", fragmentId);
		quadro.setProp("markFragmentEnd", fragmentId);
		quadro.up();
		quadro.repeatWhile("|", "u", function(cell) {
			cell.markFragment = fragmentId;
		});
		quadro.down().right();
		quadro.repeatUntil("/", "r", function(cell) {
			quadro.messageArrows[quadro.messageArrows.length - 1].type += cell.getChar();
		});
		quadro.right();
		outer: while(!quadro.getProp("markFragment")) {
			switch(textState) {
			case "INIT":
				if(quadro.check(MESSAGE_TEXT) && !quadro.getProp("markLiveBar")) {
					textState = "TEXT";
				} else {
					quadro.right();
				}
				break;
			case "TEXT":
				if(quadro.check(/\s/) || quadro.getProp("markLiveBar")) {
					textState = "SPACE";
				} else {
					quadro.messageArrows[quadro.messageArrows.length - 1].condition += quadro.getChar();
					quadro.setProp("markTextRead", true);
				}
				quadro.right();
				break;
			case "SPACE":
				if(quadro.check(/\s/) || quadro.getProp("markLiveBar")) {
					break outer;
				} else {
					quadro.messageArrows[quadro.messageArrows.length - 1].condition += " ";
					quadro.setProp("markTextRead", true, "l");
					textState = "TEXT";
				}
				break;
			default:
				throw new Error("Internal Error");
			}
		}
		quadro.repeatUntil(function(cell) { return cell.markFragment; }, "l", function() {});
		quadro.up().right();
		return states.scanMessage;
	};
	states.scanNote = function scanNote(quadro) {
		var scanActor = quadro.scanActor,
			text = "";
		quadro.right();
		quadro.repeatWhile("-", "r", function(cell) {
			cell.markNote = noteId;
			if(cell.markActorNumber) {
				scanActor = cell.markActorNumber;
			}
		});
		quadro.setProp("markNote", noteId);
		quadro.down().setProp("markNote", noteId);
		quadro.right().setProp("markNote", noteId);
		quadro.down();
		quadro.repeatWhile("|", "d", function(cell) {
			cell.markNote = noteId;
		});
		quadro.setProp("markNote", noteId);
		quadro.left();
		quadro.repeatWhile("-", "l", function(cell) {
			cell.markNote = noteId;
		});
		quadro.setProp("markNote", noteId);
		quadro.setProp("markNoteEnd", noteId);
		quadro.up();
		quadro.repeatWhile("|", "u", function(cell) {
			cell.markNote = cell.markNoteLeft = noteId;
		});
		quadro.down();
		while(!quadro.getProp("markNoteEnd")) {
			quadro.checkInBound();
			quadro.right();
			quadro.repeatUntil(function(cell) { opt.debuglog(cell); return cell.markNote; }, "r", function(cell) {
				text += cell.getChar();
				cell.markNote = noteId;
			});
			quadro.left().repeatUntil(function(cell) { return cell.markNoteLeft; }, "l", function() {});
			text += "\n";
			quadro.down();
		}
		quadro.notes[noteId++] = new Note(quadro.scanActor, scanActor, trim(text));
		return quadro.returnPosition();
	};
	states.resetMarkNoteLeft = function(quadro) {
		quadro.repeatWhile(function(cell) { return cell.markNote; }, "u", function() {});
		quadro.down();
		quadro.repeatWhile(function(cell) { return cell.markNote; }, "d", function(cell) {
			cell.markNoteLeft = cell.markNoteEnd = 0;
		});
		return quadro.returnPosition();
	};
	states.scanArrow = function scanArrow(quadro) {
		var num;
		if(quadro.check(">")) {
			if(!(num = quadro.getProp("markActorNumber", "r"))) {
				throw new Error("Parse Error");
			}
			quadro.messageArrows.push(new Message(quadro.callFrom, num, trim(quadro.messageText)));
			quadro.callFrom = null;
			quadro.messageText = "";
			quadro.right();
			return states.scanMessage;
		} else if(quadro.check("|", "d") && !quadro.getProp("markLiveBar")) {
			quadro.pushPosition(states.scanMessage, "r");
			return states.scanArrowSelf;
		} else if(quadro.messageText === "" && quadro.check(MESSAGE_TEXT, "u")) {
			quadro.setProp("markTextStart", true);
			quadro.pushPosition(states.scanArrow, "r");
			quadro.up();
			return states.scanArrowText;
		} else {
			quadro.right();
			return states.scanArrow;
		}
	};
	states.scanArrowSelf = function scanArrowSelf(quadro) {
		quadro.down().repeatWhile("|", "d", function() {});
		if(quadro.messageText === "") {
			quadro.pushPosition(states.scanArrowSelf3, "l");
			return states.scanArrowSelf2;
		} else {
			quadro.left();
			return states.scanArrowSelf3;
		}
	};
	states.scanArrowSelf2 = function scanArrowSelf2(quadro) {
		do {
			quadro.setProp("markSelfPos", true);
			for(quadro.right(); !quadro.getProp("markLiveBar"); quadro.right()) {
				if(!quadro.isInBound()) {
					throw new Error("Parse Error");
				}
				if(quadro.check(MESSAGE_TEXT)) {
					quadro.setProp("markTextStart", true, "d");
					return states.scanArrowText;
				}
			}
			quadro.repeatUntil(function(cell) { return cell.markSelfPos; }, "l", function() {});
			quadro.setProp("markSelfPos", false);
		} while(quadro.up().check("|"));
		return quadro.returnPosition();
	};
	states.scanArrowSelf3 = function scanArrowSelf3(quadro) {
		while(!(quadro.getProp("markLiveBar", "l") && quadro.check("<"))) {
			if(!quadro.isInBound()) {
				throw new Error("Parse Error");
			}
			quadro.left();
		}
		quadro.setProp("markInvalid", true);
		quadro.left().setProp("markInvalid", true);
		quadro.messageArrows.push(new Message(quadro.callFrom, quadro.callFrom, trim(quadro.messageText)));
		quadro.callFrom = null;
		quadro.messageText = "";
		return quadro.returnPosition();
	};
	states.scanResponse = function scanResponse(quadro) {
		var num;
		if(quadro.check("|") && (num = quadro.getProp("markActorNumber"))) {
			quadro.messageArrows.push(new Response(quadro.callFrom, num, trim(quadro.messageText)));
			quadro.callFrom = null;
			quadro.messageText = "";
			return states.scanMessage;
		} else if(quadro.messageText === "" && quadro.check(MESSAGE_TEXT, "u")) {
			quadro.setProp("markTextStart", true);
			quadro.pushPosition(states.scanResponse, "r");
			quadro.up();
			return states.scanArrowText;
		} else {
			quadro.right();
			return states.scanResponse;
		}
	};
	states.scanArrowText = function scanArrowText(quadro) {
		function testChar(cell) {
			return !cell.markTextRead && MESSAGE_TEXT.test(cell.getChar());
		}
		quadro.repeatWhile(testChar, "u", function() {});
		quadro.down();
		quadro.pushPosition(states.scanArrowText2, "d");
		return states.scanArrowText3;
	};
	states.scanArrowText2 = function scanArrowText2(quadro) {
		if(quadro.getProp("markTextStart")) {
			quadro.setProp("markTextStart", false);
			quadro.right();
			return quadro.returnPosition();
		} else {
			quadro.pushPosition(states.scanArrowText2, "d");
			return states.scanArrowText3;
		}
	};
	states.scanArrowText3 = function scanArrowText3(quadro) {
		function isEnd(cell) {
			return (cell.markActorNumber ||
					quadro.check(/[\s\u0000]/) && quadro.check(/[\s\u0000]/, "r"));
		}
		quadro.repeatUntil(isEnd, "r", function(cell) {
			quadro.messageText += cell.getChar();
		});
		return quadro.returnPosition();
	};
	states.actorInit = function actorInit(quadro) {
		quadro.actorNumber++;
		quadro.actors[quadro.actorNumber] = new Actor();
		quadro.setProp("markActorNumber", quadro.actorNumber);
		quadro.turnRight().forward();
		return states.actorRectangle;
	};
	states.actorRectangle = function actorRectangle(quadro) {
		quadro.repeatWhile(LABEL_BOUND, "f", function() {
			quadro.setProp("markActorNumber", quadro.actorNumber);
		});
		if(quadro.getDirection() === DIRECTION_UP) {
			quadro.down().right();
			return states.scanLabel;
		} else if(quadro.getDirection() === DIRECTION_LEFT && quadro.check("|", "d")) {
			quadro.setProp("markActorNumber", quadro.actorNumber);
			quadro.forward();
			return states.actorRectangle;
		} else {
			quadro.setProp("markActorNumber", quadro.actorNumber);
			quadro.turnRight().forward();
			return states.actorRectangle;
		}
	};
	states.scanLabel = function scanLabel(quadro) {
		var labelLine = "";
		if(quadro.getProp("markActorNumber")) {
			return states.scanLineBegin;
		} else {
			quadro.repeatUntil(function(cell) { return cell.markActorNumber; }, "r", function(cell) {
				labelLine += cell.getChar();
			});
			quadro.actors[quadro.actorNumber].labelName = trim(labelLine) + "\n";
			quadro.left();
			quadro.repeatUntil(function(cell) { return cell.markActorNumber; }, "l", function() {});
			quadro.down().right();
			return states.scanLabel;
		}
	};
	states.scanLineBegin = function scanLineBegin(quadro) {
		if(quadro.check("|", "d")) {
			quadro.down();
			return states.scanLine;
		} else if(quadro.check(LABEL_CORNER)) {
			throw new Error("Parse Error");
		} else {
			quadro.right();
			return states.scanLineBegin;
		}
	};
	states.scanLine = function scanLine(quadro) {
		if(quadro.isInBound()) {
			quadro.setProp("markActorNumber", quadro.actorNumber);
			quadro.setProp("markLiveBar", true);
			quadro.down();
			return states.scanLine;
		} else {
			return quadro.returnPosition();
		}
	};
	function Actor() {
		this.labelName = "";
	}
	function Message(callFrom, callTo, message) {
		this.callFrom = callFrom;
		this.callTo = callTo;
		this.message = message;
	}
	function Response(callFrom, callTo, message) {
		this.callFrom = callFrom;
		this.callTo = callTo;
		this.message = message;
	}
	function Note(startX, endX, text) {
		this.startX = startX;
		this.endX = endX;
		this.text = text;
	}
	function FragmentStart(startX) {
		this.type = "";
		this.condition = "";
		this.startX = startX;
		this.endX = null;
		this.id = ++fragmentId;
		fragments[this.id] = this;
	}
	function FragmentEnd(fragmentId, startX) {
		this.id = fragmentId;
		this.startX = fragments[fragmentId].startX;
		this.endX = fragments[fragmentId].endX;
	}
	if(global.window && global.window.document) {
		(function() {
			var Umalu = {};
			function createNode(type) {
				return document.createElementNS("http://www.w3.org/2000/svg", type);
			}
			function createTextSvg(canvas, text, x, y) {
				var element,
					bboxText;
				element = createNode("text");
				element.appendChild(new Text(text));
				element.setAttribute("x", x);
				element.setAttribute("y", y);
				element.setAttribute("font-family", opt.fontFamily);
				canvas.appendChild(element);
				bboxText = element.getBBox();
				element.setAttribute("dy", y - bboxText.y);
				return element;
			}
			function ActorBox(canvas, text) {
				this.canvas = canvas;
				this.text = text;
				this.x = null;
				this.y = null;
				this.width = null;
				this.height = null;
				this.xLifeline = null;
				this._text = null;
				this._box = null;
			}
			ActorBox.prototype.drawSvg = function(x, y) {
				var text,
					bboxText,
					box,
					lifeline;
				this.x = x;
				this.y = y;
				text = createTextSvg(this.canvas, this.text, x + opt.boxMargin, y + opt.boxMargin);
				bboxText = text.getBBox();
				this.width = bboxText.width + opt.boxMargin * 2;
				this.height = bboxText.height + opt.boxMargin * 2;
				this.canvas.removeChild(text);
				this._box = createNode("rect");
				this._box.setAttribute("x", x);
				this._box.setAttribute("y", y);
				this._box.setAttribute("fill", opt.fill);
				this._box.setAttribute("stroke", opt.stroke);
				this._box.setAttribute("width", this.width);
				this._box.setAttribute("height", this.height);
				this.canvas.appendChild(this._box);
				this._text = createTextSvg(this.canvas, this.text, x + opt.boxMargin, y + opt.boxMargin);
				this.xLifeline = this.x + this.width / 2
			};
			ActorBox.prototype.resetXY = function(x, y) {
				this.x = x;
				this.y = y;
				this.xLifeline = this.x + this.width / 2
				this._text.setAttribute("x", x + opt.boxMargin);
				this._text.setAttribute("y", y + opt.boxMargin);
				this._box.setAttribute("x", x);
				this._box.setAttribute("y", y);
			};
			ActorBox.prototype.drawLifelineSvg = function(y) {
				var lifeline;
				lifeline = createNode("line");
				lifeline.setAttribute("x1", this.xLifeline);
				lifeline.setAttribute("y1", this.y + this.height);
				lifeline.setAttribute("x2", this.xLifeline);
				lifeline.setAttribute("y2", y);
				lifeline.setAttribute("stroke", opt.stroke);
				this.height = y - this.y;
				this.canvas.appendChild(lifeline);
			};
			function NoteBox(canvas, text) {
				this.canvas = canvas;
				this.text = text;
				this.x = null;
				this.y = null;
				this.width = null;
				this.height = null;
				this._textElement = null;
				this._frameElement = null;
			}
			NoteBox.prototype.computeSizeSvg = function() {
				var text = createTextSvg(this.canvas, this.text, 0, 0);
				this.width = text.getBBox().width + opt.noteSize * 3;
				this.height = text.getBBox().height;
				this.canvas.removeChild(text);
				return this;
			};
			NoteBox.prototype.drawSvg = function(x, y) {
				var points1 = "";
				this.x = x;
				this.y = y;
				this._frameElement = createNode("polygon");
				points1 += x + "," + y + " ";
				points1 += (x + this.width - opt.noteSize) + "," + y + " ";
				points1 += (x + this.width) + "," + (y + opt.noteSize) + " ";
				points1 += (x + this.width) + "," + (y + this.height) + " ";
				points1 += x + "," + (y + this.height) + " ";
				points1 += x + "," + y;
				this._frameElement.setAttribute("fill", opt.fill);
				this._frameElement.setAttribute("points", points1);
				this._frameElement.setAttribute("stroke", opt.stroke);
				this.canvas.appendChild(this._frameElement);
				this._textElement = createTextSvg(this.canvas, this.text, 0, 0);
				this._textElement.setAttribute("x", x + opt.noteSize);
				this._textElement.setAttribute("y", y);
			};
			function MessageBox(canvas, text) {
				this.canvas = canvas;
				this.text = text;
				this.x = null;
				this.y = null;
				this.width = null;
				this.height = null;
				this._element = null;
			}
			MessageBox.prototype.computeSizeSvg = function() {
				this._element = createTextSvg(this.canvas, this.text, 0, 0);
				this.width = this._element.getBBox().width;
				this.height = this._element.getBBox().height;
				return this;
			};
			MessageBox.prototype.drawSvg = function(x, y) {
				this._element.setAttribute("x", x);
				this._element.setAttribute("y", y);
			};
			function Arrow(canvas, messageElement, actorFrom, actorTo) {
				this.canvas = canvas;
				this.messageElement = messageElement;
				this.actorFrom = actorFrom;
				this.actorTo = actorTo;
				this.x = null;
				this.y = null;
			}
			Arrow.prototype.drawSvg = function(y) {
				var arrow,
					arrowHead,
					toPosX,
					toPosY,
					points1 = "",
					points2 = "";
				this.x = this.actorFrom.xLifeline;
				this.y = y - this.messageElement.height;
				this.messageElement.drawSvg(this.actorFrom.xLifeline + opt.arrowMargin, this.y);
				arrowHead = createNode("polygon");
				if(this.actorFrom !== this.actorTo) {
					arrow = createNode("line");
					arrow.setAttribute("x1", this.actorFrom.xLifeline);
					arrow.setAttribute("y1", y);
					arrow.setAttribute("x2", this.actorTo.xLifeline);
					arrow.setAttribute("y2", y);
					arrow.setAttribute("stroke", opt.stroke);
					points2 += this.actorTo.xLifeline + "," + y + " ";
					points2 += (this.actorTo.xLifeline - opt.arrowSize) + "," + (y - opt.arrowSize / 2) + " ";
					points2 += (this.actorTo.xLifeline - opt.arrowSize) + "," + (y + opt.arrowSize / 2);
				} else {
					arrow = createNode("polyline");
					toPosX = this.actorFrom.xLifeline + opt.boxMargin * 2;
					toPosY = y + opt.boxMargin;
					points1 += this.actorFrom.xLifeline + "," + y + " ";
					points1 += toPosX + "," + y + " ";
					points1 += toPosX + "," + toPosY + " ";
					points1 += this.actorFrom.xLifeline + "," + (y + opt.boxMargin);
					arrow.setAttribute("fill", "none");
					arrow.setAttribute("points", points1);
					arrow.setAttribute("stroke", opt.stroke);
					arrowHead = createNode("polygon");
					points2 += this.actorFrom.xLifeline + "," + toPosY + " ";
					points2 += (this.actorFrom.xLifeline + opt.arrowSize) + "," + (toPosY - opt.arrowSize / 2) + " ";
					points2 += (this.actorFrom.xLifeline + opt.arrowSize) + "," + (toPosY + opt.arrowSize / 2);
				}
				arrowHead.setAttribute("points", points2);
				arrowHead.setAttribute("fill", opt.fill);
				arrowHead.setAttribute("stroke", opt.stroke);
				this.canvas.appendChild(arrow);
				this.canvas.appendChild(arrowHead);
			};
			function ResponseArrow(canvas, messageElement, actorFrom, actorTo) {
				this.canvas = canvas;
				this.messageElement = messageElement;
				this.actorFrom = actorFrom;
				this.actorTo = actorTo;
				this.x = null;
				this.y = null;
			}
			ResponseArrow.prototype.drawSvg = function(y) {
				var arrow,
					arrowHead,
					points2 = "";
				this.x = this.actorFrom.xLifeline;
				this.y = y - this.messageElement.height;
				this.messageElement.drawSvg(this.actorFrom.xLifeline + opt.arrowMargin, this.y);
				arrowHead = createNode("polygon");
				arrow = createNode("line");
				arrow.setAttribute("x1", this.actorFrom.xLifeline);
				arrow.setAttribute("y1", y);
				arrow.setAttribute("x2", this.actorTo.xLifeline);
				arrow.setAttribute("y2", y);
				arrow.setAttribute("stroke", opt.stroke);
				arrow.setAttribute("stroke-dasharray", opt.strokeDasharray);
				points2 += this.actorFrom.xLifeline + "," + y + " ";
				points2 += (this.actorFrom.xLifeline + opt.arrowSize) + "," + (y - opt.arrowSize / 2) + " ";
				points2 += (this.actorFrom.xLifeline + opt.arrowSize) + "," + (y + opt.arrowSize / 2);
				arrowHead.setAttribute("points", points2);
				arrowHead.setAttribute("fill", opt.fill);
				arrowHead.setAttribute("stroke", opt.stroke);
				this.canvas.appendChild(arrow);
				this.canvas.appendChild(arrowHead);
			};
			function FragmentBox(canvas, type, condition) {
				this.canvas = canvas;
				this.type = type;
				this.condition = condition;
				this.typeWidth = null;
				this.typeHeight = null;
				this.conditionWidth = null;
				this.conditionHeight = null;
				this.x = null;
				this.width = null;
				this.y = null;
				this._type = null;
				this._condition = null;
				this._frame = null;
				this._box = null;
			}
			FragmentBox.prototype.computeLabelSizeSvg = function() {
				var bbox,
					points = "",
					typeText;
				typeText = createTextSvg(this.canvas, this.type, 0, 0);
				this.typeWidth = typeText.getBBox().width + opt.fragmentMargin * 2;
				this.typeHeight = typeText.getBBox().height;
				this.canvas.removeChild(typeText);
				this._condition = createTextSvg(this.canvas, this.condition, 0, 0);
				this.conditionWidth = this._condition.getBBox().width;
				this.conditionHeight = this._condition.getBBox().height;
				return this;
			};
			FragmentBox.prototype.setStartSvg = function(startX, endX, startY) {
				this.x = startX;
				this.width = endX - startX;
				this.y = startY;
			};
			FragmentBox.prototype.drawSvg = function(endY) {
				var typeBox,
					points = "";
				this._condition.setAttribute("x", this.x + this.typeWidth + opt.boxMargin * 2);
				this._condition.setAttribute("y", this.y);
				this._box = createNode("rect");
				this._box.setAttribute("x", this.x);
				this._box.setAttribute("y", this.y);
				this._box.setAttribute("fill", "none");
				this._box.setAttribute("stroke", opt.stroke);
				this._box.setAttribute("width", this.width);
				this._box.setAttribute("height", endY - this.y);
				this.canvas.appendChild(this._box);
				typeBox = createNode("polygon");
				points += this.x + "," + this.y + " ";
				points += (this.x + this.typeWidth + opt.fragmentMargin) + "," + this.y + " ";
				points += (this.x + this.typeWidth) + "," + (this.y + this.typeHeight) + " ";
				points += this.x + "," + (this.y + this.typeHeight) + " ";
				points += this.x + "," + this.y;
				typeBox.setAttribute("points", points);
				typeBox.setAttribute("fill", opt.fragmentFill);
				typeBox.setAttribute("stroke", opt.stroke);
				this.canvas.appendChild(typeBox);
				this._type = createTextSvg(this.canvas, this.type, 0, 0);
				this._type.setAttribute("x", this.x + opt.fragmentMargin);
				this._type.setAttribute("y", this.y);
			};
			function drawSequenceDiagram(quadro) {
				var canvas,
					actorBoxes = [],
					objects = [],
					objectRef = {},
					part,
					obj,
					widthsX = [],
					xActor = [],
					fragmentNest = [],
					fragmentDepth = [],
					fragmentMaxDepth = [],
					observables = [],
					x = opt.boxMargin,
					y = opt.boxMargin,
					xBox,
					xNext,
					yNext = 0,
					yMargin,
					msgheight,
					fragmentMargin,
					i,
					j,
					k,
					l;
				canvas = quadro.canvas;
				for(i = 1; i < quadro.actors.length; i++) {
					actorBoxes[i] = new ActorBox(canvas, trim(quadro.actors[i].labelName));
					actorBoxes[i].drawSvg(x, y);
					yNext = yNext < actorBoxes[i].height ? actorBoxes[i].height : yNext;
				}
				for(i = 1; i < quadro.actors.length; i++) {
					if(fragmentMaxDepth[i] === void 0) {
						fragmentMaxDepth[i] = 0;
					}
					for(j = 0; j < quadro.messageArrowsList.length; j++) {
						fragmentNest[j] = fragmentNest[j] || [];
						for(k = 0; k < quadro.messageArrowsList[j].length; k++) {
							part = quadro.messageArrowsList[j][k];
							if(part instanceof FragmentStart && (i === part.startX || i === part.endX)) {
								if(!fragmentDepth[i]) {
									fragmentDepth[i] = {
										depth: 1,
										current: 1
									};
								} else {
									fragmentDepth[i].current++;
									fragmentDepth[i].depth = max(fragmentDepth[i].depth, fragmentDepth[i].current);
								}
								fragmentMaxDepth[i] = max(fragmentMaxDepth[i], fragmentDepth[i].depth);
								fragmentNest[j][k] = {
									depth: fragmentDepth[i],
									current: fragmentDepth[i].current
								};
							} else if(part instanceof FragmentEnd && (i === part.startX || i === part.endX)) {
								if(fragmentDepth[i].current > 1) {
									fragmentDepth[i].current--;
								} else {
									fragmentDepth[i] = null;
								}
							} else if(fragmentDepth[i] && (i === part.startX || i === part.endX)) {
								fragmentNest[j][k] = {
									depth: fragmentDepth[i],
									current: fragmentDepth[i].current
								};
							}
						}
					}
				}
				for(i = 1; i < quadro.actors.length; i++) {
					xNext = max(actorBoxes[i].width / 2, (fragmentMaxDepth[i] - 1) * opt.fragmentNestMargin + opt.boxMargin);
					xNext += i > 1 ? actorBoxes[i - 1].width / 2 + opt.boxMargin : 0;
					for(j = 0; j < quadro.messageArrowsList.length; j++) {
						objects[j] = objects[j] || [];
						for(k = 0; k < quadro.messageArrowsList[j].length; k++) {
							part = quadro.messageArrowsList[j][k];
							if(part instanceof Message && i === part.callFrom) {
								obj = new MessageBox(canvas, trim(part.message));
								obj.computeSizeSvg();
								xNext = max(xNext, obj.width);
								objects[j][k] = new Arrow(canvas, obj, actorBoxes[part.callFrom], actorBoxes[part.callTo]);
							} else if(part instanceof Response && i === part.callFrom) {
								obj = new MessageBox(canvas, trim(part.message));
								obj.computeSizeSvg();
								xNext = max(xNext, obj.width);
								objects[j][k] = new ResponseArrow(canvas, obj, actorBoxes[part.callFrom], actorBoxes[part.callTo]);
							} else if(part instanceof FragmentStart && i === part.startX) {
								obj = objects[j][k] = new FragmentBox(canvas, trim(part.type), trim(part.condition));
								obj.computeLabelSizeSvg();
								xNext = max(xNext, obj.typeWidth + opt.boxMargin);
								widthsX.push({
									start: part.startX,
									end: part.endX,
									width: obj.conditionWidth + opt.boxMargin
								});
							} else if(part instanceof Note && i === part.startX) {
								obj = objects[j][k] = new NoteBox(canvas, trim(part.text));
								obj.computeSizeSvg();
								widthsX.push({
									start: part.startX,
									end: part.endX + 1,
									width: obj.width
								});
							}
						}
					}
					for(j = 0; j < widthsX.length; j++) {
						if(widthsX[j].end === i) {
							xNext = max(xNext, widthsX[j].width + opt.boxMargin * 2);
						} else if(widthsX[j].start < i && widthsX[j].end > i) {
							widthsX[j].width -= xNext;
						}
					}
					x += xNext - actorBoxes[i].width / 2 + (i > 1 ? actorBoxes[i - 1].width / 2 : 0);
					xActor[i] = x;
				}
				for(i = 1; i < quadro.actors.length; i++) {
					actorBoxes[i].resetXY(xActor[i], y);
				}
				x += actorBoxes[i - 1].width + max(opt.boxMargin, widthsX[i] ? widthsX[i].width : 0);
				y += yNext;
				yMargin = opt.boxMargin;
				for(j = 0; j < quadro.messageArrowsList.length; j++) {
					y += yMargin;
					yNext = 0;
					yMargin = opt.boxMargin;
					for(k = 0; k < quadro.messageArrowsList[j].length; k++) {
						part = quadro.messageArrowsList[j][k];
						if(part instanceof Message || part instanceof Response) {
							msgheight = objects[j][k].messageElement.height;
							if(part.callFrom === part.callTo) {
								yMargin = max(yMargin, opt.boxMargin * 2);
							}
						} else if(part instanceof Note) {
							msgheight = objects[j][k].height / 2;
							yMargin = max(yMargin, msgheight);
						} else if(part instanceof FragmentStart) {
							msgheight = max(objects[j][k].typeHeight, objects[j][k].conditionHeight);
						} else if(part instanceof FragmentEnd) {
							msgheight = max(yNext, opt.boxMargin);
						}
						yNext = max(yNext, msgheight);
					}
					for(k = 0; k < quadro.messageArrowsList[j].length; k++) {
						part = quadro.messageArrowsList[j][k];
						if(fragmentNest[j][k]) {
							fragmentMargin = opt.fragmentNestMargin * (fragmentNest[j][k].depth.depth - fragmentNest[j][k].current);
						} else {
							fragmentMargin = -opt.fragmentNestMargin;
						}
						if(part instanceof Message || part instanceof Response) {
							objects[j][k].drawSvg(y + yNext);
						} else if(part instanceof Note) {
							observables.push(bind(
									function(obj, x, y) { obj.drawSvg(x, y); },
									objects[j][k],
									actorBoxes[part.startX].xLifeline + opt.boxMargin + opt.fragmentNestMargin + fragmentMargin,
									y + yNext - objects[j][k].height / 2));
						} else if(part instanceof FragmentStart) {
							objects[j][k].setStartSvg(
									actorBoxes[part.startX].xLifeline - objects[j][k].typeWidth - opt.boxMargin - fragmentMargin,
									actorBoxes[part.endX - 1].xLifeline + opt.boxMargin + fragmentMargin,
									y);
							objectRef[part.id] = objects[j][k];
						} else if(part instanceof FragmentEnd) {
							objectRef[part.id].drawSvg(y + opt.boxMargin);
						}
					}
					y += yNext;
				}
				y += opt.boxMargin * 2;
				for(i = 1; i < quadro.actors.length; i++) {
					actorBoxes[i].drawLifelineSvg(y);
				}
				for(i = 0; i < observables.length; i++) {
					observables[i]();
				}
				quadro.canvas.setAttribute("width", x + opt.boxMargin);
				quadro.canvas.setAttribute("height", y + opt.boxMargin);
			}
			function replaceChildNode(node, text) {
				var result,
					quadro;
				quadro = new Quadro(text);
				quadro.canvas = document.createElementNS("http://www.w3.org/2000/svg", "svg");
				node.parentNode.replaceChild(quadro.canvas, node);
				quadro.drawer = drawSequenceDiagram;
				engine(quadro, states.init);
			}
			document.addEventListener("DOMContentLoaded", function(e) {
				var i,
					scriptNodes;
				scriptNodes = document.getElementsByTagName("script");
				for(i = 0; i < scriptNodes.length;) {
					if(scriptNodes[i].type === opt.scriptType) {
						replaceChildNode(scriptNodes[i], scriptNodes[i].text);
					} else {
						i++;
					}
				}
			});
			//global.Umalu = Umalu;
		})();
	}
})();