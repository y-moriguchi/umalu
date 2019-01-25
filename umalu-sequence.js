/**
 * umalu
 *
 * Copyright (c) 2018-2019 Yuichiro MORIGUCHI
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
		twoBytesStr = '',
		TWOBYTES,
		fragmentId = 100000,
		noteId = 200000,
		lifelineId = 300000;
	defaultOptions = {
		greekBytes: 2,
		mathBytes: 2,
		debuglog: function() {} /*console.log*/,
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
		lifelineSize: 4,
		noteSize: 8
	};
	opt = defaultOptions;
	if(opt.greekBytes === 2) {
		twoBytesStr += '\u0391-\u03A9\u03b1-\u03c1\u03c3-\u03c9';
	}
	if(opt.mathBytes === 2) {
		twoBytesStr += '\u00ac\u00b1\u00d7\u00f7' +
			'\u2020\u2021\u2026' +
			'\u2200\u2202\u2203\u2205\u2207-\u2209\u220b\u2212\u2213\u221d-\u2220\u2225-\u222c\u222e' +
			'\u2234\u2235\u223d\u2243\u2245\u2248\u2252\u2260-\u2262\u2266\u2267\u226a\u226b\u2276\u2277' +
			'\u2282-\u2287\u228a\u228b\u2295-\u2297\u22a5\u22bf\u22da\u22db\u2605\u2606' +
			'\u29bf\uff01-\uff60\uffe0-\uffe6';
	}
	twoBytesStr += '\u2e80-\u2eff\u3000-\u30ff\u3300-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff\ufe30-\ufe4f';
	TWOBYTES = new RegExp('[' + twoBytesStr + ']');
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
		return string.replace(/^\s+|\s+$/g, "").replace(/\u0001/, "");
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
	function min() {
		var i,
			res;
		for(i = 0; i < arguments.length; i++) {
			if(i > 0) {
				res = res > arguments[i] ? arguments[i] : res;
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
	function quadroLength(str) {
		var xLen = 0, j;
		for(j = 0; j < str.length; j++) {
			xLen += isTwoBytes(str.charAt(j)) ? 2 : 1;
		}
		return xLen;
	}
	function isTwoBytes(ch) {
		return TWOBYTES.test(ch);
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
		this.markLiveBarOffset = -1;
		this.markTextStart = false;
		this.markFragment = 0;
		this.markFragmentAlt = 0;
		this.markFragmentEnd = 0;
		this.markNote = 0;
		this.markNoteLeft = 0;
		this.markNoteEnd = 0;
		this.markInvalid = false;
		this.markSelfPos = false;
		this.markTextRead = false;
		this.markLifelineStart = null;
		this.markLifelineEnd = null;
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
		this.fragments = [];
		this.messageFromOffset = 0;
		this.lifelineOffset = 0;
		this.lifelineStart = [];
		split = input.split(/\r?\n/);
		this._xBound = 0;
		this._yBound = split.length;
		for(i = 0; i < split.length; i++) {
			this._xBound = max(this._xBound, quadroLength(split[i]));
		}
		for(i = 0; i < split.length; i++) {
			this._quadro.push([]);
			for(j = 0; j < this._xBound; j++) {
				if(j >= split[i].length) {
					this._quadro[i].push(new Cell(" "));
				} else if(isTwoBytes(split[i].charAt(j))) {
					this._quadro[i].push(new Cell(split[i].charAt(j)));
					this._quadro[i].push(new Cell("\u0001"));
				} else {
					this._quadro[i].push(new Cell(split[i].charAt(j)));
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
		var fragment,
			alt;
		if(quadro.check("-", "r") &&
				quadro.getProp("markLiveBar") &&
				!quadro.getProp("markFragment") &&
				!quadro.getProp("markNote") &&
				!quadro.getProp("markInvalid") &&
				!quadro.getProp("markLifelineStart", "r") &&
				!quadro.getProp("markLifelineEnd", "r")) {
			quadro.callFrom = quadro.getProp("markActorNumber");
			quadro.messageFromOffset = quadro.getProp("markLiveBarOffset");
			quadro.right();
			return states.scanArrow;
		} else if(quadro.check("<", "r") &&
				quadro.getProp("markLiveBar") &&
				!quadro.getProp("markFragment") &&
				!quadro.getProp("markNote") &&
				!quadro.getProp("markInvalid")) {
			quadro.callFrom = quadro.getProp("markActorNumber");
			quadro.messageFromOffset = quadro.getProp("markLiveBarOffset");
			quadro.right();
			return states.scanResponse;
		} else if(quadro.check(LABEL_CORNER) &&
				!quadro.getProp("markActorNumber") &&
				isFragment(quadro)) {
			fragment = new FragmentStart(quadro.scanActor + 1);
			quadro.messageArrows.push(fragment);
			quadro.fragments[fragment.id] = fragment;
			quadro.setProp("markFragment", fragmentId);
			return states.scanFragment;
		} else if(quadro.check(LABEL_CORNER) &&
				!quadro.getProp("markActorNumber") &&
				isNote(quadro)) {
			quadro.setProp("markNote", noteId);
			quadro.pushPosition(states.scanMessage, "r");
			return states.scanNote;
		} else if(quadro.getProp("markFragmentAlt")) {
			alt = quadro.getProp("markFragmentAlt");
			fragment = quadro.fragments[alt.id];
			quadro.messageArrows.push(new FragmentAlt(fragment, alt.text));
			quadro.right();
			return states.scanMessage;
		} else if(quadro.getProp("markFragmentEnd")) {
			fragment = quadro.fragments[quadro.getProp("markFragmentEnd")];
			quadro.messageArrows.push(new FragmentEnd(fragment));
			quadro.right();
			return states.scanMessage;
		} else if(quadro.getProp("markNoteLeft") &&
				quadro.messageArrows[quadro.messageArrows.length - 1] instanceof Message) {
			quadro.messageArrows.push(quadro.notes[quadro.getProp("markNote")]);
			quadro.pushPosition(states.scanMessage, "r");
			return states.resetMarkNoteLeft;
		} else if(quadro.getProp("markNoteEnd")) {
			quadro.messageArrows.push(quadro.notes[quadro.getProp("markNote")]);
			quadro.right();
			return states.scanMessage;
		} else if(quadro.getProp("markLifelineStart")) {
			quadro.messageArrows.push(quadro.getProp("markLifelineStart"));
			quadro.right();
			return states.scanMessage;
		} else if(quadro.getProp("markLifelineEnd")) {
			quadro.messageArrows.push(quadro.getProp("markLifelineEnd"));
			quadro.right();
			return states.scanMessage;
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
			spaceFlag = false;
		function readText() {
			var textState = "INIT",
				result = "";
			while(!quadro.getProp("markFragment")) {
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
						result += quadro.getChar();
						quadro.setProp("markTextRead", true);
					}
					quadro.right();
					break;
				case "SPACE":
					if(quadro.check(/\s/) || quadro.getProp("markLiveBar")) {
						return result;
					} else {
						result += " ";
						quadro.setProp("markTextRead", true, "l");
						textState = "TEXT";
					}
					break;
				default:
					throw new Error("Internal Error");
				}
			}
			quadro.left();
			return "";
		}
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
		while(!quadro.getProp("markFragment")) {
			quadro.checkInBound();
			quadro.setProp("markFragment", fragmentId);
			if(quadro.check(/[~\-]/, "r")) {
				quadro.right();
				quadro.repeatUntil(function(cell) { return cell.markFragment; }, "r", function() {});
				quadro.left();
				quadro.repeatUntil(function(cell) { return cell.markFragment; }, "l", function(cell) {
					cell.markFragment = fragmentId;
				});
				quadro.down().right();
				quadro.setProp("markFragmentAlt", { id: fragmentId, text: readText() });
				quadro.repeatUntil(function(cell) { return cell.markFragment; }, "l", function() {});
				quadro.up();
			}
			quadro.up();
		}
		quadro.down().right();
		quadro.repeatUntil("/", "r", function(cell) {
			quadro.messageArrows[quadro.messageArrows.length - 1].type += cell.getChar();
		});
		quadro.right();
		quadro.messageArrows[quadro.messageArrows.length - 1].condition = readText();
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
			quadro.repeatUntil(function(cell) { return cell.markNote; }, "r", function(cell) {
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
		var num,
			message;
		if(quadro.check(">")) {
			if(!(num = quadro.getProp("markActorNumber", "r"))) {
				throw new Error("Parse Error");
			}
			message = new Message(
					quadro.callFrom,
					num,
					quadro.messageFromOffset,
					quadro.getProp("markLiveBarOffset", "r"),
					trim(quadro.messageText));
			quadro.messageArrows.push(message);
			quadro.callFrom = null;
			quadro.messageText = "";
			quadro.messageFromOffset = 0;
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
		var message;
		while(!(quadro.getProp("markLiveBar", "l") && quadro.check("<"))) {
			if(!quadro.isInBound()) {
				throw new Error("Parse Error");
			}
			quadro.left();
		}
		quadro.setProp("markInvalid", true);
		quadro.left().setProp("markInvalid", true);
		message = new Message(
				quadro.callFrom,
				quadro.callFrom,
				quadro.messageFromOffset,
				quadro.getProp("markLiveBarOffset"),
				trim(quadro.messageText));
		quadro.messageArrows.push(message);
		quadro.callFrom = null;
		quadro.messageText = "";
		quadro.messageFromOffset = 0;
		return quadro.returnPosition();
	};
	states.scanResponse = function scanResponse(quadro) {
		var num,
			response;
		if(quadro.check("|") && (num = quadro.getProp("markActorNumber"))) {
			response = new Response(
					quadro.callFrom,
					num,
					quadro.messageFromOffset,
					quadro.getProp("markLiveBarOffset"),
					trim(quadro.messageText));
			quadro.messageArrows.push();
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
			quadro.messageText += "\n";
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
			quadro.actors[quadro.actorNumber].labelName = "";
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
			quadro.actors[quadro.actorNumber].labelName += trim(labelLine) + "\n";
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
		var lifeline;
		if(quadro.check("-") &&
				quadro.check(LABEL_CORNER, "l") &&
				quadro.check(LABEL_CORNER, "r") &&
				quadro.getProp("markLifelineStart") === null &&
				quadro.getProp("markLifelineEnd") === null) {
			lifeline = new LifelineStart(quadro.actorNumber, quadro.lifelineOffset);
			quadro.lifelineStart.unshift(lifeline);
			quadro.setProp("markLifelineStart", lifeline);
			quadro.pushPosition(states.scanLine, "d");
			return states.scanLifeline;
		} else if(quadro.isInBound()) {
			quadro.setProp("markActorNumber", quadro.actorNumber);
			quadro.setProp("markLiveBar", true);
			quadro.setProp("markLiveBarOffset", 0);
			quadro.down();
			return states.scanLine;
		} else {
			quadro.lifelineStart.shift();
			return quadro.returnPosition();
		}
	};
	states.scanLifeline = function scanLifeline(quadro) {
		quadro.pushPosition(states.scanLifelineRight, "r");
		return states.scanLifelineLeft;
	};
	states.scanLifelineLeft = function scanLifelineLeft(quadro) {
		if(quadro.check("-") &&
				quadro.check(LABEL_CORNER, "l") &&
				quadro.check(LABEL_CORNER, "r") &&
				quadro.getProp("markLifelineStart") === null &&
				quadro.getProp("markLifelineEnd") === null) {
			quadro.lifelineOffset++;
			quadro.setProp("markLifelineEnd", new LifelineEnd(quadro.lifelineStart[0]));
			return quadro.returnPosition();
		} else if(quadro.isInBound()) {
			quadro.setProp("markActorNumber", quadro.actorNumber, "l");
			quadro.setProp("markLiveBar", true, "l");
			quadro.setProp("markLiveBarOffset", quadro.lifelineOffset - 1, "l");
			quadro.down();
			return states.scanLifelineLeft;
		} else {
			throw new Error("Parse Error");
		}
	};
	states.scanLifelineRight = function scanLifelineRight(quadro) {
		var lifeline;
		if(quadro.check("-") &&
				quadro.check(LABEL_CORNER, "l") &&
				quadro.check(LABEL_CORNER, "r") &&
				quadro.getProp("markLifelineStart") === null &&
				quadro.getProp("markLifelineEnd") === null) {
			lifeline = new LifelineStart(quadro.actorNumber, quadro.lifelineOffset);
			quadro.lifelineStart.unshift(lifeline);
			quadro.setProp("markLifelineStart", lifeline);
			quadro.pushPosition(states.scanLifelineRight, "d");
			return states.scanLifeline;
		} else if(quadro.getProp("markLifelineEnd", "l") !== null) {
			quadro.lifelineOffset--;
			quadro.lifelineStart.shift();
			return quadro.returnPosition();
		} else if(quadro.isInBound()) {
			quadro.setProp("markActorNumber", quadro.actorNumber);
			quadro.setProp("markLiveBar", true);
			quadro.setProp("markLiveBarOffset", quadro.lifelineOffset);
			quadro.down();
			return states.scanLifelineRight;
		} else {
			throw new Error("Parse Error");
		}
	};
	function Actor() {
		this.labelName = "";
	}
	function LifelineStart(actorNumber, offset) {
		this.actorNumber = actorNumber;
		this.offset = offset;
		this.id = ++lifelineId;
	}
	function LifelineEnd(lifelineStart) {
		this.lifelineStart = lifelineStart;
	}
	function Message(callFrom, callTo, offsetFrom, offsetTo, message) {
		this.callFrom = callFrom;
		this.callTo = callTo;
		this.offsetFrom = offsetFrom;
		this.offsetTo = offsetTo;
		this.message = message;
	}
	function Response(callFrom, callTo, offsetFrom, offsetTo, message) {
		this.callFrom = callFrom;
		this.callTo = callTo;
		this.offsetFrom = offsetFrom;
		this.offsetTo = offsetTo;
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
	}
	function FragmentAlt(fragmentStart, text) {
		this.id = fragmentStart.id;
		this.text = text;
		this.startX = fragmentStart.startX;
		this.endX = fragmentStart.endX;
	}
	function FragmentEnd(fragmentStart) {
		this.id = fragmentStart.id;
		this.startX = fragmentStart.startX;
		this.endX = fragmentStart.endX;
	}
	if(global.window && global.window.document) {
		(function() {
			var Umalu = {};
			function MultiLineText(canvas, text, x, y, align, width, height) {
				var split,
					i,
					bbox,
					xNext,
					yNext = y;
				this.x = x;
				this.y = y;
				this.align = align;
				this.texts = [];
				if(width) {
					this.size = {
						width: width,
						height: height
					};
				} else {
					this.size = getSizeOfText(canvas, text);
				}
				split = text.split("\n");
				for(i = 0; i < split.length; i++) {
					this.texts[i] = createTextSvg(canvas, split[i], x, yNext);
					bbox = this.texts[i].getBBox();
					this.texts[i].setAttribute("x", this.alignX(bbox.width));
					yNext += bbox.height;
				}
			}
			MultiLineText.prototype.alignX = function(boxX) {
				switch(this.align) {
				case "center":  return this.x + (this.size.width - boxX) / 2;
				case "left":    return this.x;
				case "right":   return this.x + this.size.width - boxX;
				default:        throw new Error("Internal Error");
				}
			};
			MultiLineText.prototype.setAttribute = function(attr, value) {
				var i,
					bbox,
					yNext;
				switch(attr) {
				case "x":
					this.x = value;
					for(i = 0; i < this.texts.length; i++) {
						bbox = this.texts[i].getBBox();
						this.texts[i].setAttribute(attr, this.alignX(bbox.width));
					}
					break;
				case "y":
					this.y = yNext = value;
					for(i = 0; i < this.texts.length; i++) {
						bbox = this.texts[i].getBBox();
						this.texts[i].setAttribute(attr, yNext);
						yNext += bbox.height;
					}
					break;
				default:
					throw new Error("Internal Error");
				}
			};
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
			function getSizeOfText(canvas, text) {
				var x = 0,
					y = 0,
					split,
					text,
					bboxText,
					i;
				split = text.split("\n");
				for(i = 0; i < split.length; i++) {
					text = createTextSvg(canvas, split[i], 0, 0);
					bboxText = text.getBBox();
					x = max(x, bboxText.width);
					y += bboxText.height;
					canvas.removeChild(text);
				}
				return {
					width: x,
					height: y
				};
			}
			function ActorBox(canvas, text) {
				this.canvas = canvas;
				this.text = text;
				this.x = null;
				this.y = null;
				this.width = null;
				this.height = null;
				this.xLifeline = null;
				this.lifelines = [];
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
				bboxText = getSizeOfText(this.canvas, this.text);
				this.width = bboxText.width + opt.boxMargin * 2;
				this.height = bboxText.height + opt.boxMargin * 2;
				this._box = createNode("rect");
				this._box.setAttribute("x", x);
				this._box.setAttribute("y", y);
				this._box.setAttribute("fill", opt.fill);
				this._box.setAttribute("stroke", opt.stroke);
				this._box.setAttribute("width", this.width);
				this._box.setAttribute("height", this.height);
				this.canvas.appendChild(this._box);
				this._text = new MultiLineText(this.canvas,
						this.text,
						x + opt.boxMargin,
						y + opt.boxMargin,
						"center",
						bboxText.width,
						bboxText.height);
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
			ActorBox.prototype.addLifeline = function(depth, lifeline) {
				if(!this.lifelines[depth]) {
					this.lifelines[depth] = [];
				}
				this.lifelines[depth].push(lifeline);
			};
			ActorBox.prototype.drawLifelineSvg = function(y) {
				var lifeline,
					i,
					j;
				lifeline = createNode("line");
				lifeline.setAttribute("x1", this.xLifeline);
				lifeline.setAttribute("y1", this.y + this.height);
				lifeline.setAttribute("x2", this.xLifeline);
				lifeline.setAttribute("y2", y);
				lifeline.setAttribute("stroke", opt.stroke);
				this.height = y - this.y;
				this.canvas.appendChild(lifeline);
				for(i = 0; i < this.lifelines.length; i++) {
					for(j = 0; j < this.lifelines[i].length; j++) {
						this.lifelines[i][j].drawSvg();
					}
				}
			};
			function LifelineBox(canvas) {
				this.canvas = canvas;
				this.x = null;
				this.y = null;
				this.width = null;
				this.height = null;
			};
			LifelineBox.prototype.drawSvg = function() {
				var box;
				box = createNode("rect");
				box.setAttribute("x", this.x);
				box.setAttribute("y", this.y);
				box.setAttribute("fill", "white");
				box.setAttribute("stroke", opt.stroke);
				box.setAttribute("width", this.width);
				box.setAttribute("height", this.height);
				this.canvas.appendChild(box);
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
				var bboxText = getSizeOfText(this.canvas, this.text);
				this.width = bboxText.width + opt.noteSize * 3;
				this.height = bboxText.height;
				return this;
			};
			NoteBox.prototype.drawSvg = function(x, y) {
				var polyline2,
					points1 = "",
					points2 = "";
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
				this._textElement = new MultiLineText(this.canvas, this.text, x + opt.noteSize, y, "left");
				polyline2 = createNode("polyline");
				points2 += (x + this.width) + "," + (y + opt.noteSize) + " ";
				points2 += (x + this.width - opt.noteSize) + "," + (y + opt.noteSize) + " ";
				points2 += (x + this.width - opt.noteSize) + "," + y;
				polyline2.setAttribute("fill", "none");
				polyline2.setAttribute("points", points2);
				polyline2.setAttribute("stroke", opt.stroke);
				this.canvas.appendChild(polyline2);
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
				var bboxText = getSizeOfText(this.canvas, this.text);
				this.width = bboxText.width;
				this.height = bboxText.height;
				return this;
			};
			MessageBox.prototype.drawSvg = function(x, y) {
				this._element = new MultiLineText(this.canvas, this.text, x, y, "left", this.width, this.height);
			};
			function Arrow(canvas, messageElement, actorFrom, actorTo, offsetFrom, offsetTo) {
				this.canvas = canvas;
				this.messageElement = messageElement;
				this.actorFrom = actorFrom;
				this.actorTo = actorTo;
				this.offsetFrom = offsetFrom;
				this.offsetTo = offsetTo;
				this.x = null;
				this.y = null;
				this.yArrow = null;
			}
			Arrow.prototype.isSelf = function() {
				return this.actorFrom === this.actorTo;
			};
			Arrow.prototype.drawSvg = function(y, yMargin) {
				var arrow,
					arrowHead,
					toX,
					toPosX,
					toPosY,
					points1 = "",
					points2 = "";
				this.x = this.actorFrom.xLifeline + this.offsetFrom * opt.lifelineSize;
				this.y = y - this.messageElement.height;
				this.yArrow = y;
				this.messageElement.drawSvg(this.actorFrom.xLifeline + opt.arrowMargin, this.y);
				arrowHead = createNode("polygon");
				if(this.actorFrom !== this.actorTo) {
					toX = this.actorTo.xLifeline + this.offsetTo * opt.lifelineSize;
					arrow = createNode("line");
					arrow.setAttribute("x1", this.x);
					arrow.setAttribute("y1", y);
					arrow.setAttribute("x2", toX);
					arrow.setAttribute("y2", y);
					arrow.setAttribute("stroke", opt.stroke);
					points2 += toX + "," + y + " ";
					points2 += (toX - opt.arrowSize) + "," + (y - opt.arrowSize / 2) + " ";
					points2 += (toX - opt.arrowSize) + "," + (y + opt.arrowSize / 2);
				} else {
					toX = this.actorFrom.xLifeline + this.offsetTo * opt.lifelineSize;
					arrow = createNode("polyline");
					toPosX = toX + opt.boxMargin * 2;
					toPosY = y + (this.offsetFrom !== this.offsetTo ? yMargin : opt.boxMargin);
					points1 += this.x + "," + y + " ";
					points1 += toPosX + "," + y + " ";
					points1 += toPosX + "," + toPosY + " ";
					points1 += toX + "," + toPosY;
					arrow.setAttribute("fill", "none");
					arrow.setAttribute("points", points1);
					arrow.setAttribute("stroke", opt.stroke);
					arrowHead = createNode("polygon");
					points2 += toX + "," + toPosY + " ";
					points2 += (toX + opt.arrowSize) + "," + (toPosY - opt.arrowSize / 2) + " ";
					points2 += (toX + opt.arrowSize) + "," + (toPosY + opt.arrowSize / 2);
				}
				arrowHead.setAttribute("points", points2);
				arrowHead.setAttribute("fill", opt.fill);
				arrowHead.setAttribute("stroke", opt.stroke);
				this.canvas.appendChild(arrow);
				this.canvas.appendChild(arrowHead);
			};
			function ResponseArrow(canvas, messageElement, actorFrom, actorTo, offsetFrom, offsetTo) {
				this.canvas = canvas;
				this.messageElement = messageElement;
				this.actorFrom = actorFrom;
				this.actorTo = actorTo;
				this.offsetFrom = offsetFrom;
				this.offsetTo = offsetTo;
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
					bboxText = getSizeOfText(this.canvas, this.type);
				this.typeWidth = bboxText.width + opt.fragmentMargin * 2;
				this.typeHeight = bboxText.height;
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
			FragmentBox.prototype.drawAltSvg = function(y, text) {
				var altLine,
					altText;
				altLine = createNode("line");
				altLine.setAttribute("x1", this.x);
				altLine.setAttribute("y1", y);
				altLine.setAttribute("x2", this.x + this.width);
				altLine.setAttribute("y2", y);
				altLine.setAttribute("stroke", opt.stroke);
				altLine.setAttribute("stroke-dasharray", opt.strokeDasharray);
				this.canvas.appendChild(altLine);
				if(text) {
					altText = createTextSvg(this.canvas, text, 0, 0);
					altText.setAttribute("x", this.x + this.typeWidth + opt.boxMargin * 2);
					altText.setAttribute("y", y);
				}
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
				var UNDETERMINED = -100000,
					canvas,
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
					fragmentNestEnd = 0,
					fragmentMaxNestEnd = 0,
					observables = [],
					x = opt.boxMargin,
					y = opt.boxMargin,
					xBox,
					xNext,
					yNext = 0,
					yMargin,
					msgheight,
					fragmentMargin,
					noteMargin,
					altTextSize,
					i,
					j,
					k,
					l;
				function getNoteMargin(quadro, j, k) {
					if(quadro.messageArrowsList[j][k - 1] &&
							quadro.messageArrowsList[j][k - 1] instanceof Message &&
							quadro.messageArrowsList[j][k - 1].callFrom === quadro.messageArrowsList[j][k - 1].callTo) {
						return opt.boxMargin * 2;
					} else {
						return 0;
					}
				}
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
								if(part.endX >= quadro.actors.length) {
									fragmentNestEnd++;
									fragmentMaxNestEnd++;
								}
								fragmentNest[j][k] = {
									depth: fragmentDepth[i],
									depthEnd: fragmentNestEnd,
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
								objects[j][k] = new Arrow(
										canvas,
										obj,
										actorBoxes[part.callFrom],
										actorBoxes[part.callTo],
										part.offsetFrom,
										part.offsetTo);
							} else if(part instanceof Response && i === part.callFrom) {
								obj = new MessageBox(canvas, trim(part.message));
								obj.computeSizeSvg();
								xNext = max(xNext, obj.width);
								objects[j][k] = new ResponseArrow(
										canvas,
										obj,
										actorBoxes[part.callFrom],
										actorBoxes[part.callTo],
										part.offsetFrom,
										part.offsetTo);
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
									width: obj.width + getNoteMargin(quadro, j, k)
								});
							} else if(part instanceof LifelineStart && i === part.actorNumber) {
								obj = objects[j][k] = new LifelineBox(canvas);
								actorBoxes[i].addLifeline(part.offset, obj);
								xNext = max(xNext, part.offset * opt.lifelineSize + opt.boxMargin);
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
				x += actorBoxes[i - 1].width / 2;
				for(j = 0; j < widthsX.length; j++) {
					if(widthsX[j].end === i) {
						xNext = max(xNext, widthsX[j].width + opt.boxMargin);
					}
				}
				x += xNext;
				y += yNext;
				yMargin = opt.boxMargin;
				for(j = 0; j < quadro.messageArrowsList.length; j++) {
					y += yMargin <= UNDETERMINED ? opt.boxMargin : yMargin;
					yNext = 0;
					yMargin = UNDETERMINED;
					for(k = 0; k < quadro.messageArrowsList[j].length; k++) {
						part = quadro.messageArrowsList[j][k];
						if(part instanceof Message || part instanceof Response) {
							msgheight = objects[j][k].messageElement.height;
							if(part.callFrom !== part.callTo) {
								yMargin = max(yMargin, opt.boxMargin);
							} else if(quadro.messageArrowsList[j + 1] && (function() {
										var m,
											obj;
										for(m = 0; m < quadro.messageArrowsList[j + 1].length; m++) {
											obj = quadro.messageArrowsList[j + 1][m];
											if(obj instanceof LifelineStart && obj.actorNumber === part.callTo) {
												return obj;
											}
										}
										return false;
									})()) {
								yMargin = max(yMargin, opt.boxMargin);
							} else {
								yMargin = max(yMargin, opt.boxMargin * 2);
							}
						} else if(part instanceof Note) {
							msgheight = objects[j][k].height / 2;
							yMargin = max(yMargin, msgheight + opt.boxMargin);
						} else if(part instanceof FragmentStart) {
							msgheight = max(objects[j][k].typeHeight, objects[j][k].conditionHeight);
						} else if(part instanceof FragmentAlt) {
							altTextSize = getSizeOfText(canvas, part.text);
							msgheight = altTextSize.height;
						} else if(part instanceof FragmentEnd) {
							msgheight = max(yNext, 0);
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
							objects[j][k].drawSvg(y + yNext, yMargin);
						} else if(part instanceof Note) {
							noteMargin = actorBoxes[part.startX].xLifeline;
							noteMargin += getNoteMargin(quadro, j, k);
							noteMargin += opt.boxMargin + opt.fragmentNestMargin + fragmentMargin;
							observables.push(bind(
									function(obj, x, y) { obj.drawSvg(x, y); },
									objects[j][k],
									noteMargin,
									y + yNext - objects[j][k].height / 2));
						} else if(part instanceof FragmentStart) {
							objects[j][k].setStartSvg(
									actorBoxes[part.startX].xLifeline - objects[j][k].typeWidth - opt.boxMargin - fragmentMargin,
									actorBoxes[part.endX - 1].xLifeline + opt.boxMargin + fragmentMargin +
											opt.fragmentNestMargin * (fragmentMaxNestEnd - fragmentNest[j][k].depthEnd),
									y);
							objectRef[part.id] = objects[j][k];
						} else if(part instanceof FragmentAlt) {
							observables.push(bind(
									function(obj, y, text) { obj.drawAltSvg(y, text); },
									objectRef[part.id],
									y,
									part.text));
						} else if(part instanceof FragmentEnd) {
							observables.push(bind(function(obj, y) { obj.drawSvg(y); }, objectRef[part.id], y));
						} else if(part instanceof LifelineStart) {
							objectRef[part.id] = objects[j][k];
							objects[j][k].x = actorBoxes[part.actorNumber].xLifeline + (part.offset - 1) * opt.lifelineSize;
							objects[j][k].width = opt.lifelineSize * 2;
							objects[j][k].y = y;
							yMargin = yMargin < 0 ? 0 : yMargin;
						} else if(part instanceof LifelineEnd) {
							objectRef[part.lifelineStart.id].height = y - objectRef[part.lifelineStart.id].y;
							yMargin = yMargin < 0 ? 0 : yMargin;
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