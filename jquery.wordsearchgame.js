
/*!
 * The Word Search Game Widget
 *
 * Copyright 2011, Ryan Fernandes (https://code.google.com/u/@VBFTRFJWDxFDXgJ4/)
 * Licensed under The MIT License.
 * see license.txt
 *
 */

//==============================================================================
//------------------------------------------------------------------------------  
//The Word Search Game Widget
//------------------------------------------------------------------------------  
//	
//	------
//	Usage:
//	------
//		$(document).ready( function () {
//		var words = "earth,mars,mercury,neptune,pluto,saturn,jupiter,one,two,
//		        three,four,five,six,seven,eight,mozart,bach,meyer,rose,mahler";
//		$("#theGrid").wordsearchwidget({
//      "wordlist" : words,
//      "gridsize" : 12, 
//      "allowhelp" : true,
//		onWordFound: function(object) {
//		    alert(object.word);
//		    },
//		onWordSearchComplete: function() {
//			alert("Game over");
//		    }
//		});
//		});
//	
//  -------
//  Inputs: 
//  -------
//  gridsize - Size of grid to generate (this will be a square)
//	wordlist - Comma separated list of words to place on the grid
//  allowhelp - Whether to allow user assistance in finding words
//	
//	-------------
//	What it does: 				
//	-------------
//	Creates a grid of letters with words from the wordlist
//	These words are randomly placed in the following directions
//	1. Horizontal
//	2. Vertical
//	3. Left-Diagonal
//	4. Right-Diagonal
//	In addition, the letters are placed in forward or reverse order, randomly
//	Provision is made to overlap words
//	
//	The User is expected to click on a letter and drag to the last letter of the 
//	word. If the selected letters form a word that is in the word list the UI
//	will indicate that by crossing it out from the wordlist
//	
//	If the user cannot find a word, she has to click on that word in the 
//	wordlist and the UI will hightlight the word in the grid and cross it out
//	
//	------------------
//	Technical Details:
//	------------------ 
//	
//		Contains 3 areas: 
//			a) main game grid (#rf-searchgamecontainer)
//			b) list of words to be found (#rf-wordcontainer)
//			c) list of words that have been found (#rf-foundwordcontainer)
//		
//		Data Structures used:
//		---------------------
//			Objects related to the Data Model
//			0) Model
//				a) Grid
//					1) Cell
//					2) HorizontalPopulator
//					3) VerticalPopulator
//					4) LeftDiagonalPopulator
//					5) RightDiagonalPopulator
//					
//				b) WordList
//					1) Word
//			
//			Objects related to View
//			1) Root
//			2) Hotzone
//			3) Arms
//			4) Visualizer
//			
//			Objects related to the controller
//			1) GameWidgetHelper 		
//			
//			
//  -------
//  Events: 
//  -------		
//	onWordFound:
//		This event is called whenever a user finds a word in the list. The function passes an object with two properties:
//			id: The index of the word in the list
//			word: The name of the word found.
//
//	onWordSearchComplete:
//		This event is called when all the words in the list have been found and the game ends.
//==============================================================================

(function( $, undefined ) {

	var requestRunning = false //avoid multiple quick wordcontainer call error (alternative is to make highlight delay shorter than two clicks can happen, e.g., 50ms rather than 500)
    var overlappedWordList = new Array()
    
    var currentWord = 0;	
	var maxWords = 0;
	var onWordFound = undefined;
    var onWordSearchComplete = undefined;
    
    $.widget("ryanf.wordsearchwidget", $.ui.mouse, {

            options : {
                wordlist : null,
                gridsize : 10,
                allowhelp : true,
                onWordFound : undefined,
				onWordSearchComplete : undefined
            },
			_mapEventToCell: function(event) {
                var currentColumn = Math.ceil((event.pageX - this._cellX) / this._cellWidth);
                var currentRow = Math.ceil((event.pageY - this._cellY) / this._cellHeight);
                var el = $('#rf-tablegrid tr:nth-child('+currentRow+') td:nth-child('+currentColumn+')');
                return el;
			},
            
            _create : function () {
                //member variables
                //note: do/while checks for repeating words and recreates as needed
                do {
                    this.model      = GameWidgetHelper.prepGrid(this.options.gridsize, this.options.wordlist);
                } while (checkRepeatedWords(this.model) == "repeats");

                this.startedAt  = new Root();
                this.hotzone    = new Hotzone();
                this.arms       = new Arms();
                
                onWordFound = this.options.onWordFound;
				onWordSearchComplete = this.options.onWordSearchComplete;
                maxWords = this.options.wordlist.split(",").length;
                
				GameWidgetHelper.renderGame(this.element[0],this.model);
				
				this.options.distance=0; // set mouse option property
                this._mouseInit();
                
                var cell = $('#rf-tablegrid tr:first td:first');
                this._cellWidth = cell.outerWidth();
                this._cellHeight = cell.outerHeight();
                this._cellX = cell.offset().left;
                this._cellY = cell.offset().top;

            }, //_create
            
            destroy : function () {
                
                this.hotzone.clean();
                this.arms.clean();
                this.startedAt.clean();
                
				this._mouseDestroy();
				return this;
                
            },
            
            //mouse callbacks
            
            _mouseStart: function(event, allowhelp = this.options.allowhelp) {
				
				var panel = $(event.target).parents("div").attr("id")
				
				if ( panel == 'rf-searchgamecontainer') {
					this.startedAt.setRoot( event.target )
					this.hotzone.createZone( event.target )
				}
				else if ( panel == 'rf-wordcontainer' && allowhelp == true) {
					
					//User has requested help. Identify the word on the grid
					//We have a reference to the td in the cells that make up this word
					var idx = $(event.target).parent().children().index(event.target);

					var selectedWord = this.model.wordList.get(idx);
					if (!requestRunning)
						Visualizer.highlightHelp(selectedWord);
					
				}

            },
            
            _mouseDrag : function(event) {
                event.target = this._mapEventToCell(event); 
                //if this.root (aka this.startedAt) - clear out everything and return to original clicked state
                if (this.startedAt.isSameCell(event.target)) {
                    this.arms.returnToNormal();
                    this.hotzone.setChosen(-1);
                    return;
                }
                
                //if event is on an armed cell
                if ($(event.target).hasClass("rf-armed") || $(event.target).hasClass("rf-glowing") ) { //CHANGE! 
                    
                    //if in hotzone
                    var chosenOne = this.hotzone.index(event.target);

                    //console.log(chosenOne)
                    if (chosenOne!= -1) {

                        //set target to glowing; set rest of hotzone to armed
                        this.hotzone.setChosen(chosenOne);
                        
                        //calculate arms and set to armed
                        this.arms.deduceArm(this.startedAt.root, chosenOne);

                    }

                    //important: needed to glow cell next to root (fixed rendering issues around root)
                    this.arms.glowTo(event.target);
                    
                }
                
            },
            
            _mouseStop : function (event) {

                //get word
				var selectedword = '';
                $('.rf-glowing, .rf-glowing-root, .rf-highlight', this.element[0]).each(function() {
                        var u = $.data(this, "cell");
                        selectedword += u.value;
                });

                var wordIndex = this.model.wordList.isWordPresent(selectedword)
                if (wordIndex!=-1) {
                    $('.rf-glowing, .rf-glowing-root, .rf-highlight', this.element[0]).each(function() {
                            Visualizer.select(this);
                            $.data(this, "selected", "true");

                    });
                    GameWidgetHelper.signalWordFound(wordIndex)
                }

                var panel = $(event.target).parents("div").attr("id");
                //alert(panel)
                
				//if ( panel == 'rf-searchgamecontainer' || panel == 'rf-wordcontainer') {

				this.hotzone.returnToNormal();
				this.startedAt.returnToNormal();
                this.arms.returnToNormal();
                
				//	}
            }
            
        }
    ); //widget


$.extend($.ryanf.wordsearchwidget, {
	version: "0.0.1"
});

//------------------------------------------------------------------------------
// VIEW OBJECTS 
//------------------------------------------------------------------------------
/*
 * The Arms represent the cells that are selectable once the hotzone has been 
 * exited/passed
 */
function Arms() {
    this.arms = null;

    //deduces the arm based on the cell from which it exited the hotzone.
    this.deduceArm = function (root, idx) {

        this.returnToNormal(); //clear old arm
        var ix = $(root).parent().children().index(root);

        //create the new nominees
        this.arms = new Array();

        //create surrounding nominees
        switch (idx) {
            case 0: //horizontal left
                this.arms = $(root).prevAll();
                break;

            case 1: //horizontal right
                this.arms = $(root).nextAll();
                break;

            case 2: //vertical top
                var $n = this.arms;
                $(root).parent().prevAll().each( function() {
                    $n.push($(this).children().get(ix));
                });
                
                break;

            case 3: //vertical bottom
                var $o = this.arms;
                $(root).parent().nextAll().each( function() {
                    $o.push($(this).children().get(ix));
                });
                break;

            case 4: //right diagonal up
                
                var $p = this.arms;

                //for all prevAll rows
                var currix = ix;
                $(root).parent().prevAll().each( function () {
                    $p.push($(this).children().get(++currix));
                });
                break;

            case 5: //left diagonal up
                var $q = this.arms;

                //for all prevAll rows
                var currixq = ix;
                $(root).parent().prevAll().each( function () {
                    $q.push($(this).children().get(--currixq));
                });
                break;

            case 6 : //left diagonal down
                var $r = this.arms;
                //for all nextAll rows
                var currixr = ix;
                $(root).parent().nextAll().each( function () {
                    $r.push($(this).children().get(++currixr));
                });
                break;

            case 7: //right diagonal down
                var $s = this.arms;
                //for all nextAll rows
                var currixs = ix;
                $(root).parent().nextAll().each( function () {
                    $s.push($(this).children().get(--currixs));
                });
                break;


        }
        for (var x=0;x<this.arms.length;x++) {
            Visualizer.arm(this.arms[x]);
        }
    }

	//lights up the cells that from the root cell to the current one
    this.glowTo = function (upto) {
        var to = $(this.arms).index(upto);

        for (var x=0;x<this.arms.length;x++) { //light up through hot zone
            
            if (x<=to) {
                Visualizer.glow(this.arms[x]);
            }
            else {
                Visualizer.arm(this.arms[x]);
            }
        }
    }
	
	//clear out the arms 
    this.returnToNormal = function () {
        if (!this.arms) return;
        
        for (var t=0;t<this.arms.length;t++) { //don't clear the hotzone
            Visualizer.restore(this.arms[t]);
        }
    }
    
    
    this.clean = function() {
        $(this.arms).each(function () {
           Visualizer.clean(this); 
        });
    }
 
}

/*
 * Object that represents the cells that are selectable around the root cell
 */
function Hotzone() {
    
    this.elems = null;
    
    //define the hotzone
    //select all neighboring cells as nominees
    this.createZone = function (root) {
        this.elems = new Array(); 
        
        var $tgt = $(root);
        var ix = $tgt.parent().children().index($tgt);

        var above = $tgt.parent().prev().children().get(ix); // above
        var below = $tgt.parent().next().children().get(ix); // below

        //nominatedCells.push(event.target); // self
        this.elems.push($tgt.prev()[0],$tgt.next()[0]); //horizontal
        this.elems.push( above, below, 
                            $(above).next()[0],$(above).prev()[0], //diagonal
                            $(below).next()[0],$(below).prev()[0] //diagonal
                          );


        $(this.elems).each( function () {
            if ($(this)!=null) {
                Visualizer.arm(this);
            }
        });
        
    }
    //give the hotzone some intelligence
    this.index = function (elm) {
        return $(this.elems).index(elm);
    }

    this.setChosen = function (chosenOne) {
        for (var x=0;x<this.elems.length;x++) {
            Visualizer.arm(this.elems[x]);
        }
        if (chosenOne != -1) {
            Visualizer.glow(this.elems[chosenOne]);
        }

    }

    this.returnToNormal = function () {

        if (this.elems != null) // in case there is nothing to restore (e.g., fresh puzzle)
            for (var t=0;t<this.elems.length;t++) {
                Visualizer.restore(this.elems[t]);
            }
    }
    
    this.clean = function() {
        $(this.elems).each(function () {
           Visualizer.clean(this); 
        });
    }
    
}

/*
 * Object that represents the first cell clicked
 */
function Root() {
    this.root = null;
    
    this.setRoot = function (root) {
        this.root = root;
        Visualizer.glowRoot(this.root);
    }
    
    this.returnToNormal = function () {
        Visualizer.restoreRoot(this.root);
    }
    
    this.isSameCell = function (t) {
        return $(this.root).is($(t));
    }
    
    this.clean = function () {
        Visualizer.clean(this.root);
    }
    
}

/*
 * A utility object that manipulates the cell display based on the methods called.
 */
var Visualizer = {
	
    glow : function (c) {
        $(c).removeClass("rf-armed")
            .removeClass("rf-selected")
            .addClass("rf-glowing");
    },
    
    glowRoot : function (c) {
        $(c).removeClass("rf-armed")
            .removeClass("rf-selected")
            .addClass("rf-glowing-root");
    },
    
    arm : function (c) {
        $(c)//.removeClass("rf-selected")
            .removeClass("rf-glowing")
            .addClass("rf-armed");
            
        if ( c!=null && $.data(c,"selected") == "true" ) {
            $(c).addClass("rf-selected");
        }
        
    },
    
    restore : function (c) {
        $(c).removeClass("rf-armed")
            .removeClass("rf-glowing");
        
        // added rf-highlight to avoid highlightHelp graphical issue
        if ( c!=null && $.data(c,"selected") == "true" && !$(c).hasClass("rf-highlight")) {
            $(c).addClass("rf-selected");
        }
    },
    
    restoreRoot : function (c) {

        $(c).removeClass("rf-armed")
            .removeClass("rf-glowing-root");
        
        // added rf-highlight to avoid highlightHelp graphical issue
        if ( c!=null && $.data(c,"selected") == "true" && !$(c).hasClass("rf-highlight")) {
            $(c).addClass("rf-selected");
        }
    },
    
    select : function (c) {
    	requestRunning = true;
        $(c).removeClass("rf-armed")
            .removeClass("rf-glowing")
			.animate({'opacity' : '20'}, 300, "linear", function () {

				$(c).removeClass("rf-highlight").addClass("rf-selected")
				.animate({'opacity' : 'show'}, 300, "linear", requestRunning = false)
			})
    },
    
    /*
    highlight : function (c) {
        $(c).removeClass("rf-armed")
            .removeClass("rf-selected")
			.addClass("rf-highlight");
    },
    */
    
    //this function fixes the highlighting issue for overlapped words by using manually set cellUsedLocations (array where cellUsedLocations[i][0] = row and cellUsedLocations[i][1] = col)
    highlightHelp : function (w) {
    
        for (i=0;i<w.size;i++) {
            theCells = $("#rf-tablegrid tr:eq("+(w.cellsUsedLocations[i][0])+") td:eq("+(w.cellsUsedLocations[i][1])+")")
            
            theCells.removeClass("rf-armed")
                    .removeClass("rf-selected")
                    .removeClass("rf-glowing")
                    .removeClass("rf-glowing-root")
                    .addClass("rf-highlight")
        	}
    },
	
    signalWordFound : function (w) {
        requestRunning = true;

		$(w).css("background",'yellow').animate({"opacity": 'hide'},300,"linear",
					 function () {
						 $(w).css("background",'white')
						 $(w).addClass('rf-foundword').animate({"opacity": 'show'},300,"linear", requestRunning = false)
					 });
    },

	clean : function (c) {
        $(c).removeClass("rf-armed")
            .removeClass("rf-glowing")
            .removeClass("rf-glowing-root")
            .removeClass("rf-selected");
            
        $.removeData($(c),"selected");    
        
    }
}

//--------------------------------------------------------
// OBJECTS RELATED TO THE MODEL
//------------------------------------------------------------------------------

/*
 * Represents the individual cell on the grid
 */
function Cell() {
    this.DEFAULT = "-";
    this.isHighlighted = false;
    this.value = this.DEFAULT;
    this.parentGrid = null;
    this.isUnwritten = function () {
        return (this.value == this.DEFAULT);
    };
    this.isSelected = false;
    this.isSelecting = true;
	this.td = null; // reference to UI component

    
}//Cell

/*
 * Represents the Grid
 */
function Grid() {
    this.cells = null;
    
    this.directions = [
				"LeftDiagonal",
				"Horizontal",
				"RightDiagonal",
				"Vertical"
                      ];
    
    this.initializeGrid= function(size) {
        this.cells = new Array(size);
        for (var i=0;i<size;i++) {
            this.cells[i] = new Array(size);
            for (var j=0;j<size;j++) {
                var c = new Cell();
                c.parentgrid = this;
                this.cells[i][j] = c;
            }
        }
    }
    
    
    this.getCell = function(row,col) {
        return this.cells[row][col];
    }
    
    this.createHotZone = function(uic) {
        var $tgt = uic;

        var hzCells = new Array(); 
        var ix = $tgt.parent().children().index($tgt);

    }
    
    this.size = function() {
        return this.cells.length;
    }
    
    //place word on grid at suggested location
    this.put = function(row, col, word) {
        //Pick the right Strategy to place the word on the grid
        var populator = eval("new "+ eval("this.directions["+Math.floor(Math.random()*4)+"]") +"Populator(row,col,word, this)");
        var isPlaced= populator.populate();
        
        //Didn't get placed.. brute force-fit (if possible)
        if (!isPlaced) {
            for (var x=0;x<this.directions.length;x++) {
                var populator2 = eval("new "+ eval("this.directions["+x+"]") +"Populator(row,col,word, this)");
                var isPlaced2= populator2.populate();
                if (isPlaced2) break;
                
            }
            
        }
    }
    
    this.fillGrid = function() {
   
    for (var i=0;i<this.size();i++) {
        for (var j=0;j<this.size();j++) {
            if (this.cells[i][j].isUnwritten()) {
                this.cells[i][j].value = String.fromCharCode(Math.floor(65+Math.random()*26));
            }
        }
    }
        
    }

}//Grid

/*
 * Set of strategies to populate the grid.
 */
//Create a Horizontal Populator Strategy 
function HorizontalPopulator(row, col, word, grid) {
    
    this.grid = grid;
    this.row =  row;
    this.col = col;
    this.word = word;
    this.size = this.grid.size();
    this.cells = this.grid.cells;
    
    //populate the word
    this.populate = function() {
        

        // try and place word in this row

        // check if this row has a contiguous block free
        // 1. starting at col (honour the input)
        if (this.willWordFit()) {
            this.writeWord();
        }
        else {

            // for every row - try to fit this
            for (var i=0;i<this.size;i++) {

                var xRow = (this.row+i)%this.size; // loop through all rows starting at current;

                // 2. try starting anywhere on line
                var startingPoint = this.findContiguousSpace(xRow, word);

                if (startingPoint == -1) {
                    // if not, then try to see if we can overlap this word only any existing alphabets
                    var overlapPoint = this.isWordOverlapPossible(xRow, word);
                    if (overlapPoint == -1) {
                        // if not, then try another row and repeat process,
                        continue;
                    }
                    else {
                        this.row = xRow;
                        this.col = overlapPoint;
                        this.writeWord();
                        break;
                    }
                }
                else {
                    this.row = xRow;
                    this.col = startingPoint;
                    this.writeWord();
                    break;
                }
            }//for each row
        }
        // if still not, then return false (i.e. not placed. we need to try another direction
        return (word.isPlaced);
            
        
    }//populate

    
    //write word on grid at given location
    //also remember which cells were used for displaying the word
    this.writeWord = function () {

        var chars = word.chars;
        var lrow = this.row;
        var lcol = this.col;
        word.row = this.row+1;
        word.col = this.col+1;

        for (var i=0;i<word.size;i++) {
            var c = new Cell();
            c.value = chars[i];
            word.cellsUsedLocations.push(new Array(this.row,this.col+i))
            this.cells[this.row][this.col+i] = c;
            word.containedIn(c);
            word.isPlaced = true;
        }
        //console.log(word)

    }

    //try even harder, check if this word can be placed by overlapping cells with same content
    this.isWordOverlapPossible = function (row, word) {
        return -1; //TODO: implement
    }

    //check if word will fit at the chosen location
    this.willWordFit = function() {
        var isFree = false;
        var freeCounter=0;
        var chars = this.word.chars;
        for (var i=col;i<this.size;i++) {
            if (this.cells[row][i].isUnwritten() || this.cells[row][i] == chars[i] ) {
                freeCounter++;
                if (freeCounter == word.size) {
                    isFree = true;
                    break;
                }
            }
            else {
                break;
            }
        }
        return isFree;
    }
    
    //try harder, check if there is contiguous space anywhere on this line.
    this.findContiguousSpace = function (row, word) {
        var freeLocation = -1;
        var freeCounter=0;
        var chars = word.chars;
        for (var i=0;i<this.size;i++) {
            if (this.cells[row][i].isUnwritten() || this.cells[row][i] == chars[freeCounter]) {
                freeCounter++;
                if (freeCounter == word.size) {
                    freeLocation = (i - (word.size-1));
                    break;
                }
            }
            else {
                freeCounter=0;
            }
        }
        return freeLocation;
        
    }
}//HorizontalPopulator


//Create a Vertical Populator Strategy 
function VerticalPopulator(row, col, word, grid) {
    
    this.grid = grid;
    this.row =  row;
    this.col = col;
    this.word = word;
    this.size = this.grid.size();
    this.cells = this.grid.cells;
    
    //populate the word
    this.populate = function() {
        

        // try and place word in this row

        // check if this row has a contiguous block free
        // 1. starting at col (honour the input)
        if (this.willWordFit()) {
            this.writeWord();
        }
        else {

            // for every row - try to fit this
            for (var i=0;i<this.size;i++) {

                var xCol = (this.col+i)%this.size; // loop through all rows starting at current;

                // 2. try starting anywhere on line
                var startingPoint = this.findContiguousSpace(xCol, word);

                if (startingPoint == -1) {
                    // if not, then try to see if we can overlap this word only any existing alphabets
                    var overlapPoint = this.isWordOverlapPossible(xCol, word);
                    if (overlapPoint == -1) {
                        // if not, then try another row and repeat process,
                        continue;
                    }
                    else {
                        this.row = overlapPoint;
                        this.col = xCol;
                        this.writeWord();
                        break;
                    }
                }
                else {
                    this.row = startingPoint;
                    this.col = xCol;
                    this.writeWord();
                    break;
                }
            }//for each row
        }
        // if still not, then return false (i.e. not placed. we need to try another direction
        return (word.isPlaced);
            
        
    }//populate

    
    //write word on grid at given location
    //also remember which cells were used for displaying the word
    this.writeWord = function () {

        var chars = word.chars;
        var lrow = this.row;
        var lcol = this.col;
        word.row = this.row+1;
        word.col = this.col+1;

        for (var i=0;i<word.size;i++) {
            var c = new Cell();
            c.value = chars[i];
            word.cellsUsedLocations.push(new Array(this.row+i,this.col))
            this.cells[this.row+i][this.col] = c; //CHANGED
            word.containedIn(c);
            word.isPlaced = true;
        }
        
    }

    //try even harder, check if this word can be placed by overlapping cells with same content
    this.isWordOverlapPossible = function (col, word) {
        return -1; //TODO: implement
    }

    //check if word will fit at the chosen location
    this.willWordFit = function() {
        var isFree = false;
        var freeCounter=0;
        var chars = this.word.chars;
        
        //for (p=0;p<15;p++)
        	//for (q=0;q<15;q++)
        	//	console.log(p + ' ' + q + ' ' + this.cells[p][q].value)
        
        for (var i=row;i<this.size;i++) { // CHANGED
            if (this.cells[i][col].isUnwritten() || chars[i] == this.cells[i][col].value) { //CHANGED
            	//if (chars[i] == this.cells[i][col].value)
            		//console.log(chars[i] + ' ' + this.cells[i][col].value + ' ' + chars)
                freeCounter++;
                if (freeCounter == word.size) {
                    isFree = true;
                    break;
                }
            }
            else {
                break;
            }
        }
        return isFree;
    }
    
    //try harder, check if there is contiguous space anywhere on this line.
    this.findContiguousSpace = function (col, word) {
        
        //console.log(word)
        
        var freeLocation = -1;
        var freeCounter=0;
        //var overlapCounter = 0
        var chars = word.chars;
        for (var i=0;i<this.size;i++) {
            if (this.cells[i][col].isUnwritten() || chars[freeCounter] == this.cells[i][col].value) { //CHANGED
            	/*if (chars[i] == this.cells[i][col].value) {
            		console.log(chars[i] + ' ' + this.cells[i][col].value + ' ' + chars)
            		overlapCounter++
            		}*/
                freeCounter++;
                
                if (freeCounter == word.size) {
                    freeLocation = (i - (word.size-1));
                    //console.log(freeLocation)
                    break;
                }
            }
            else {
                freeCounter=0;
            }
        }
        return freeLocation;
        
    }
}//VerticalPopulator


//Create a LeftDiagonal Populator Strategy 
function LeftDiagonalPopulator(row, col, word, grid) {
    
    this.grid = grid;
    this.row =  row;
    this.col = col;
    this.word = word;
    this.size = this.grid.size();
    this.cells = this.grid.cells;
    
    //populate the word
    this.populate = function() {
        

        // try and place word in this row

        // check if this row has a contiguous block free
        // 1. starting at col (honour the input)
        if (this.willWordFit()) {
            this.writeWord();
        }
        else {

            var output = this.findContiguousSpace(this.row,this.col, word);

            if (output[0] != true) {
                
                // for every row - try to fit this
                OUTER:for (var col=0, row=(this.size-word.size); row>=0; row--) {
                    for (var j=0;j<2;j++) {

                        var op = this.findContiguousSpace( (j==0)?row:col, (j==0)?col:row, word);

                        if (op[0] == true) {
                            this.row = op[1];
                            this.col = op[2];
                            this.writeWord();
                            break OUTER;
                        }
                    }
                    
                }
           }
            else {
                this.row = output[1];
                this.col = output[2];
                this.writeWord();
            }


        }
        // if still not, then return false (i.e. not placed. we need to try another direction
        return (word.isPlaced);
            
        
    }//populate

    
    //write word on grid at given location
    //also remember which cells were used for displaying the word
    this.writeWord = function () {

        var chars = word.chars;
        var lrow = this.row;
        var lcol = this.col;
        word.row = this.row+1;
        word.col = this.col+1;

        for (var i=0;i<word.size;i++) {
            var c = new Cell();
            c.value = chars[i];
            word.cellsUsedLocations.push(new Array(lrow,lcol))
            this.cells[lrow++][lcol++] = c;
            word.containedIn(c);
            word.isPlaced=true;
        }

    }

    //try even harder, check if this word can be placed by overlapping cells with same content
    this.isWordOverlapPossible = function (row, word) {
        return -1; //TODO: implement
    }

    //check if word will fit at the chosen location
    this.willWordFit = function() {
        var isFree = false;
        var freeCounter=0;
        var chars = this.word.chars;
        var lrow = this.row;
        var lcol = this.col;
        var i=0;
        while (lcol < this.grid.size() && lrow < this.grid.size()) {
            if (this.cells[lrow][lcol].isUnwritten() || this.cells[lrow][lcol] == chars[i++] ) {
                freeCounter++;
                if (freeCounter == word.size) {
                    isFree = true;
                    break;
                }
            }
            else {
                break;
            }
            lrow++;
            lcol++;
            
        }
        return isFree;
    }
    
    //try harder, check if there is contiguous space anywhere on this line.
    this.findContiguousSpace = function (xrow, xcol,word) {
        var freeLocation = false;
        var freeCounter=0;
        var chars = word.chars;
        var lrow = xrow;
        var lcol = xcol;
        
        while (lrow > 0 && lcol > 0) {
            lrow--;
            lcol--;
        }
        var i=0;
        while (true) {
            if (this.cells[lrow][lcol].isUnwritten() || this.cells[lrow][lcol] == chars[i++]) {
                freeCounter++;
                if (freeCounter == word.size) {
                    freeLocation = true;
                    break;
                }
            }
            else {
                freeCounter=0;
                i=0
            }
            lcol++;
            lrow++;
            
            if (lcol >= this.size || lrow >= this.size) {
                break;
            }
        }
        if (freeLocation) {
            lrow = lrow - word.size+1;
            lcol = lcol - word.size+1;
        }
        return [freeLocation,lrow,lcol];
        
    }
}//LeftDiagonalPopulator


//Create a RightDiagonal Populator Strategy 
function RightDiagonalPopulator(row, col, word, grid) {

    this.grid = grid;
    this.row = row;
    this.col = col;
    this.word = word;
    this.size = this.grid.size();
    this.cells = this.grid.cells;
    
    //populate the word
    this.populate = function() {
        

        // try and place word in this row

        // check if this row has a contiguous block free
        // 1. starting at col (honour the input)
        var rr=0;
        if (this.willWordFit()) {
            this.writeWord();
        }
        else {

            var output = this.findContiguousSpace(this.row,this.col, word);

            if (output[0] != true) {
                
                // for every row - try to fit this
                OUTER:for (var col=this.size-1, row=(this.size-word.size); row>=0; row--) {
                    for (var j=0;j<2;j++) {

                        var op = this.findContiguousSpace( (j==0)?row:(this.size-1-col), (j==0)?col:(this.size-1-row), word);

                        if (op[0] == true) {
                            this.row = op[1];
                            this.col = op[2];
                            this.writeWord();
                            break OUTER;
                        }
                    }
                    
                }
           }
            else {
                this.row = output[1];
                this.col = output[2];
                this.writeWord();
            }


        }
        // if still not, then return false (i.e. not placed. we need to try another direction
        return (word.isPlaced);
            
        
    }//populate

    
    //write word on grid at given location
    //also remember which cells were used for displaying the word
    this.writeWord = function () {

        // reverse rightdiagonal placement for left-to-right reading
        word.chars = word.value.split('').reverse();
        word.value = word.value.split('').reverse().join('');

        var chars = word.chars;
        var lrow = this.row;
        var lcol = this.col;
        word.row = this.row+1;
        word.col = this.col+1;
        
        for (var i=0;i<word.size;i++) {
            var c = new Cell();
            c.value = chars[i];
            word.cellsUsedLocations.push(new Array(lrow,lcol))
            this.cells[lrow++][lcol--] = c;
            word.containedIn(c);
            word.isPlaced = true;
        }

    }

    //try even harder, check if this word can be placed by overlapping cells with same content
    this.isWordOverlapPossible = function (row, word) {
        return -1; //TODO: implement
    }

    //check if word will fit at the chosen location
    this.willWordFit = function() {
        var isFree = false;
        var freeCounter=0;
        var chars = this.word.chars;
        var lrow = this.row;
        var lcol = this.col;
        var i=0;
        while (lcol >= 0 && lrow < this.grid.size()) {
            if (this.cells[lrow][lcol].isUnwritten() || this.cells[lrow][lcol] == chars[i++] ) {
                freeCounter++;
                if (freeCounter == word.size) {
                    isFree = true;
                    break;
                }
            }
            else {
                break;
            }
            lrow++;
            lcol--;
            
        }
        return isFree;
    }
    
    //try harder, check if there is contiguous space anywhere on this line.
    this.findContiguousSpace = function (xrow, xcol, word) {
        var freeLocation = false;
        var freeCounter=0;
        var chars = word.chars;
        var lrow = xrow;
        var lcol = xcol;
        
        while (lrow > 0 && lcol < this.size-1) {
            lrow--;
            lcol++;
        }
        var i=0;
        while (lcol >= 0 && lrow < this.grid.size()) {
            if (this.cells[lrow][lcol].isUnwritten() || this.cells[lrow][lcol] == chars[i++]) {
                freeCounter++;
                if (freeCounter == word.size) {
                    freeLocation = true;
                    break;
                }
            }
            else {
                freeCounter=0;
                i=0
            }
            lrow++;
            lcol--;
//            if (lcol <= 0 || lrow > this.size-1) {
//                break;
//            }
        }
        if (freeLocation) {
            lrow = lrow - word.size+1;
            lcol = lcol + word.size-1;
        }
        return [freeLocation,lrow,lcol];
        
    }
}//RightDiagonalPopulator

/*
 * Container for the Entire Model
 */
function Model() {
    this.grid= null;
    this.wordList= null;
    
    this.init = function(grid, list) {
        this.grid = grid;
        this.wordList = list;
    
        for (var i=0; i<this.wordList.size(); i++) {
            grid.put( Util.random(this.grid.size()), Util.random(this.grid.size()), this.wordList.get(i) );
        }

    }
    
}//Model

/*
 * Represents a word on the grid
 */
function Word(val) {
    this.value = val.toUpperCase();
    this.originalValue = this.value;
    this.isFound= false;
    this.cellsUsed = new Array();
    this.cellsUsedLocations = new Array();

    this.isPlaced = false;
    this.row = -1;
    this.col = -1;
    this.size = -1;
    this.chars = null;

    this.init = function () {
        this.chars = this.value.split("");
        this.size = this.chars.length;
    }
    this.init();
    
    this.containedIn = function (cell) {
        this.cellsUsed.push(cell);
    }
	
	
    
    this.checkIfSimilar = function (w) {
        if (this.originalValue == w || this.value == w) {
            this.isFound = true;
            return true;
        }
        return false;
    }
    

}

/*
 * Represents the list of words to display
 */
function WordList() {
    this.words = new Array();
    
    this.loadWords = function (csvwords) {

		//word list checks
        csvwordsList = csvwords.toUpperCase().split(",")

		for (i = 0; i<csvwordsList.length; i++) {

            //remove leading white space
            csvwordsList[i] = jQuery.trim(csvwordsList[i])

            //check for spaces in words
            if (/\s/.test(csvwordsList[i])) {
                msg = 'Words in the word list should not contain spaces! Aborting...';
                alert(msg);
                throw new Error(msg);
            }

            //check for non letter characters
            for (j = 0; j<csvwordsList[i].length; j++) {
                if (csvwordsList[i][j].toUpperCase() == csvwordsList[i][j].toLowerCase()) {
                    msg = 'Words in the word list should not contain unusual characters (e.g., hyphens)! Aborting...';
                    alert(msg);
                    throw new Error(msg);
                }
            }

        }

        //check for duplicate words
        csvwordsListDeduped = csvwordsList.filter( function( element, index, array ) { return array.indexOf(element) == index; });
        if (csvwordsList.length != csvwordsListDeduped.length) {
            msg = 'Duplicate words detected in the word list! Aborting...';
            alert(msg);
            throw new Error(msg);
        }

        //check for partial overlap
        for (i = 0; i<csvwordsList.length; i++) {
            csvwordsListOther = csvwordsList.slice(0)
            csvwordsListOther.splice(i, 1)
            for (j = 0; j<csvwordsListOther.length; j++)
                if (csvwordsListOther[j].includes(csvwordsList[i])) {
                    msg = 'Partial overlap detected in the word list! Aborting...';
                    alert(msg);
                    throw new Error(msg);
                }
        }
		
        var $n = this.words;
        $(csvwordsList).each(function () {
            $n.push(new Word(this));
        });
        
    }
    
    this.add = function(word) {
        //here's where we reverse the letters randomly
        if (Math.random()*10 >5) {
            var s="";
            for (var i=word.size-1;i>=0;i--) {
                s = s+ word.value.charAt(i);
            }
            word.value = s;
            word.init();
        }
        this.words[this.words.length] = word;
    }
    
    this.size = function() {
        return this.words.length;
    }
    
    this.get = function(index) {
        return this.words[index];
    }
    
    this.isWordPresent = function(word2check) {
        for (var x=0;x<this.words.length;x++) {
            if (this.words[x].checkIfSimilar(word2check)) return x;
        }
        return -1;
    }
}

/*
 * Utility class
 */
var Util = {
    random : function(max) {
        return Math.floor(Math.random()*max);
    },
    
    log : function (msg) {
        $("#logger").append(msg);
    }
} 

/*
Overlapped word check
*/
function checkOverlappedWords (model) {
	for (i=0; i<model.wordList.words.length;i++) {
		//console.log(model.wordList.words[i])
		for (j=0; j<model.wordList.words[i].cellsUsed.length; j++) {
			//console.log(model.wordList.words[i].cellsUsed[j].td)
			if (!model.wordList.words[i].cellsUsed[j].td) {
				console.log('Overlapped Word: ' + model.wordList.words[i].value)
				//console.log(model.wordList.words[i])
			}
		}
    }
}

/*
Repeated word check
*/
function checkRepeatedWords (model) {

    checkResult = "clear"

    words = model.wordList.words
    cells = model.grid.cells

    for (j = 0; j<words.length; j++)
        words[j].occurences = 0

    theSequences = new Array();

    //horizontal
    for (i = 0; i<cells.length; i++) {
        theRow = ''
        for (j = 0; j<cells[0].length; j++)
            theRow += cells[i][j].value
        theSequences.push(theRow)
    }

    //left and right diagonals

    // credit to: https://stackoverflow.com/questions/35917734/how-do-i-traverse-an-array-diagonally-in-javascript
    function getAllDiagonal(array) {
        function row(offset) {
            var i = array.length, a = '';
            while (i--) {
                a += array[i][j + (offset ? offset - i : i)] || '';
            }
            return a;
        }
    
        var result = [[], []], j;
        for (j = 1 - array.length; j < array[0].length; j++) {
            result[0].push(row(0));
            result[1].push(row(array.length - 1));
        }
        return result;
    }
    
    res = getAllDiagonal(theSequences)
    leftDiag = res[0]
    rightDiag = res[1]
    //console.log(leftDiag)
    //console.log(rightDiag)
    theSequences.concat(leftDiag).concat(rightDiag)

    //vertical
    for (i = 0; i<cells.length; i++) {
        theCol = ''
        for (j = 0; j<cells[0].length; j++)
            theCol += cells[j][i].value
        theSequences.push(theCol)
    }

    for (i = 0; i < theSequences.length; i++)
        for (j = 0; j<words.length; j++) {
            theWord = words[j].value
            theWordReverse = theWord.split('').reverse().join('');
            theOccurences = (theSequences[i].split(theWord).length - 1) + (theSequences[i].split(theWordReverse).length - 1)
            words[j].occurences += theOccurences
            /*
            if (words[j].occurences > 1 && theOccurences > 0) {
                console.log(theWord)
                console.log(theSequences[i])
            }
            */
        }

    for (j = 0; j<words.length; j++)
        if (words[j].occurences > 1) {
            console.log('Repeated Word: ' + words[j].value)
            //console.log(words[j])
            checkResult = "repeats"
            console.log('Reseting due to repeat...')
        }

    return(checkResult)

}


//------------------------------------------------------------------------------
// OBJECTS RELATED TO THE CONTROLLER
//------------------------------------------------------------------------------
/*
 * Main controller that interacts with the Models and View Helpers to render and
 * control the game
 */
var GameWidgetHelper = {
	prepGrid : function (size, words) {
		var grid = new Grid();
		grid.initializeGrid(size);

		var wordList = new WordList();
		wordList.loadWords(words);

		var model = new Model();
		model.init(grid, wordList);
		grid.fillGrid();
		return model;

	},
	
    renderGame : function(container, model) {
        var grid = model.grid;
        var cells = grid.cells;
        
        var puzzleGrid = "<div id='rf-searchgamecontainer'><table id='rf-tablegrid' cellspacing=0 cellpadding=0 class='rf-tablestyle'>";
        for (var i=0;i<grid.size();i++) {
            puzzleGrid += "<tr>";
            for (var j=0;j<grid.size();j++) {
                puzzleGrid += "<td class='rf-tgrid'>"+cells[i][j].value+"</td>";
            }
            puzzleGrid += "</tr>";
        }
        puzzleGrid += "</table></div>";
        $(container).append(puzzleGrid);

        var x=0;
        var y=0;
        $("tr","#rf-tablegrid").each(function () {
        	//console.log(this)
            $("td", this).each(function (col){
                var c = cells[x][y++];
				$.data(this,"cell",c);
				c.td = this;
            }) 
            y=0;
            x++;
        });
       
        var words = "<div id='rf-wordcontainer'><ul>"
        $(model.wordList.words).each(function () {
            words += '<li class=rf-p'+this.isPlaced+'>'+this.originalValue+'</li>';
        });
        words += "</ul></div>";

        $(container).append(words);

		checkOverlappedWords(model)
    },
	
	signalWordFound : function(idx) {
		var w = $("#theGrid li").get(idx);
		if (!jQuery(w).hasClass('rf-foundword')){
			Visualizer.signalWordFound(w);
			currentWord++;
			if (typeof onWordFound == "function"){
					onWordFound({id:idx,word:$(w).text()});
				}
			if (typeof onWordSearchComplete == "function"){
					if (currentWord >= maxWords){
						onWordSearchComplete({});
					}
				}
			}	
	}
	
}


})(jQuery);