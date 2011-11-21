/**
 *  Copyright 2010 Scriptoid s.r.l
 **/

/**
 *Handles are created on-the-fly for a figure. They are completelly managed by the HandleManager
 *Each handle is responsable for an action. The {Handle} does not need to keep a reference to the parent shape
 *as the HandleManager will do that.
 *@constructor
 *@this {Handle}
 *@param {String} type - the type of handle
 **/
function Handle(type){
    /**Type of Handle*/
    this.type = type;

    /*These are stupidly initialized to 0 but they should not be present at all...
     *anyway they got set to the proper values in HandleManager::handleGetAll() function*/
    
    /**The center of the circle (x coordinates)*/
    this.x = 0;
    
    /**The center of the circle (y coordinates)*/
    this.y = 0;
    
    /**Used by Connector handles, to not display redundant handles (i.e. when they are on the same line)*/
    this.visible = true;
}

/**It's a (static) vector of handle types
 * Note: R - stand for rotation
 * Note: More handles might be added in the future : like handles to increase the number of edges for a hexagone
 * Those handles will be specific for a figure
 **/
Handle.types = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw', 'r' ]; //DO NOT CHANGE THE ORDER OF THESE VALUES

/**It's a (static) vector of connector types*/
Handle.connectorTypes = ['ns', 'ew'];

/**Creates a {Handle} out of JSON parsed object
 *@param {JSONObject} o - the JSON parsed object
 *@return {Handle} a newly constructed Handle
 *@author Alex Gheorghiu <alex@scriptoid.com>
 **/
Handle.load = function(o){
    var newHandle = new Handle(o.type);
    newHandle.x = o.x;
    newHandle.y = o.y;
    newHandle.visible = o.visible;
    return newHandle;
}

/**Creates an array of handles from an array of {JSONObject}s
 *@param {Array} v - the array of JSONObjects
 *@return an {Array} of {Handle}s
 *@author Alex Gheorghiu <alex@scriptoid.com>
 **/
Handle.loadArray = function(v){
    var newHandles = [];
    for(var i=0; i< v.length; i++){
        newHandles.push(Handle.load(v[i]));
    }
    return newHandles;
}

/**Default handle radius*/
Handle.RADIUS = 3;

Handle.prototype = {
    
    constructor : Handle,
    
    /**Compares to another Handle
     *@param {Handle} group -  - the other glue
     *@return {Boolean} - true if equals, false otherwise
     **/
    equals : function(anotherHandle){
        if(!anotherHandle instanceof Handle){
            return false;
        }

        return this.type == anotherHandle.type
            && this.x == anotherHandle.x
            && this.y == anotherHandle.y
            && this.visible == anotherHandle.visible;
    },

    
    /**Handle actions for Figure
     *
     *@param {Array } lastMove - an array that will hold [x,y] of last x & y coordinates
     *@param {Number} newX - new X coordinate
     *@param {Number} newY - new Y coordinate
     **/
    actionFigure: function(lastMove, newX, newY){
        var figBounds=HandleManager.figure.getBounds();
        
        var transX = 0; //the amount of translation on Ox
        var transY = 0; //the amount of translation on Oy
        var scaleX = 1; //the scale percentage on Ox
        var scaleY = 1; //the scale percentage on Oy
        var arc = false;
        
        //see if we have a resize and prepare the figure by moving it back to Origin and "unrotate" it
        if(this.type == 'r'){
            //rotationCoords[0] is always the center of the shape, we clone it as when we do -rotationCoords[0].x, it is set to 0.
            var center = HandleManager.figure.rotationCoords[0].clone();
            var endAngle = Util.getAngle(HandleManager.figure.rotationCoords[0],new Point(newX,newY));
            var startAngle = Util.getAngle(HandleManager.figure.rotationCoords[0],HandleManager.figure.rotationCoords[1]);//new Point(lastMove[0],lastMove[1])
            var rotAngle = endAngle - startAngle;


//            HandleManager.figure.transform(Matrix.translationMatrix(-center.x, -center.y))
//            HandleManager.figure.transform(Matrix.rotationMatrix(rotAngle))
//            HandleManager.figure.transform(Matrix.translationMatrix(center.x, center.y));
            
            var equivTransfMatrix = Matrix.mergeTransformations(
                    Matrix.translationMatrix(-center.x, -center.y), 
                    Matrix.rotationMatrix(rotAngle), 
                    Matrix.translationMatrix(center.x,center.y)
                );
                    
            
            //TODO: make somehow to compute the inverse of it.
            //@see http://en.wikipedia.org/wiki/Transformation_matrix#Rotation to find inverses

            var inverseTransfMatrix = Matrix.mergeTransformations(
                    Matrix.translationMatrix(-center.x, -center.y), 
                    Matrix.rotationMatrix(-rotAngle), 
                    Matrix.translationMatrix(center.x,center.y)
                );
            
            var cmdRotate = new RotateFigureCommand(HandleManager.figure.id, equivTransfMatrix, inverseTransfMatrix);
            cmdRotate.execute();
            History.addUndo(cmdRotate);
                
        }
        else{ //if not "rotate" (figure), "updown", "leftright" (connector)
            //find the angle by which the figure was rotated (for any figure this is initally 0 so if != than 0 we have a rotation)
            var angle = Util.getAngle(HandleManager.figure.rotationCoords[0], HandleManager.figure.rotationCoords[1]);

            //save initial figure's center
            var oldCenter = HandleManager.figure.rotationCoords[0].clone();

            

            //move the new [x,y] to the "un-rotated" and "un-translated" space
            var p = new Point(newX,newY);
            p.transform(Matrix.translationMatrix(-oldCenter.x,-oldCenter.y));
            p.transform(Matrix.rotationMatrix(-angle));
            p.transform(Matrix.translationMatrix(oldCenter.x,oldCenter.y));
            newX = p.x;
            newY = p.y;

            var handlerPoint=new Point(this.x,this.y) //Handler's center point (used to draw it's circle)
            //rotate that as well.
            handlerPoint.transform(Matrix.translationMatrix(-oldCenter.x,-oldCenter.y));
            handlerPoint.transform(Matrix.rotationMatrix(-angle));
            handlerPoint.transform(Matrix.translationMatrix(oldCenter.x,oldCenter.y));
            
            
            
            switch(this.type){
                case 'n':
                    /*move the xOy coodinates at the bottom of the figure and then scale*/
                    transY = figBounds[3];
                    if(newY < figBounds[3]-5){ //North must not get too close to South
                        scaleY = (figBounds[3]-newY)/(figBounds[3] - handlerPoint.y);
                    }
                    break;

                case 's':
                    /*move the xOy coodinates at the top of the figure (superfluous as we are there already) and then scale*/
                    transY = figBounds[1];
                    if(newY > figBounds[1]+5){ //South must not get too close to North
                        scaleY = (newY-figBounds[1])/(handlerPoint.y-figBounds[1]);
                    }
                    break;

                case 'w':
                    /*move the xOy coordinates at the right of the figure and then scale*/
                    transX = figBounds[2];
                    if(newX < figBounds[2]-5){ //West(newX) must not get too close to East(figBounds[2])
                        scaleX = (figBounds[2]-newX)/(figBounds[2]-handlerPoint.x);
                    }
                    break;

                case 'e':
                    /*move the xOy coodinates at the left of the figure (superfluous as we are there already) and then scale*/
                    transX = figBounds[0];
                    if(newX > figBounds[0]+5){
                        scaleX = (newX-figBounds[0])/(handlerPoint.x-figBounds[0]);
                    }
                    break;

                case 'nw':
                    /*You can think as a combined North and West action*/
                    transX = figBounds[2];
                    transY = figBounds[3];
                    if(newX<figBounds[2]-5 && newY<figBounds[3]-5){
                        scaleY = (figBounds[3]-newY) /(figBounds[3]-handlerPoint.y);
                        scaleX = (figBounds[2]-newX) / (figBounds[2]-handlerPoint.x);
                    }
                    break;

                case 'ne':
                    transX = figBounds[0]
                    transY = figBounds[3];
                    if(newX>figBounds[0]+5 && newY<figBounds[3]-5){
                        scaleX = (newX-figBounds[0])/(handlerPoint.x-figBounds[0]);
                        scaleY = (figBounds[3]-newY)/(figBounds[3]-handlerPoint.y);
                    }
                    break;

                case 'sw':
                    transX = figBounds[2]
                    transY = figBounds[1];
                    if(newX<figBounds[2]-5 && newY>figBounds[1]+5){
                        scaleX = (figBounds[2]-newX)/((figBounds[2]-handlerPoint.x));
                        scaleY = (newY-figBounds[1])/(handlerPoint.y-figBounds[1]);
                    }
                    break;

                case 'se':
                    transX = figBounds[0];
                    transY = figBounds[1];
                    if(newX>figBounds[0]+5 && newY>figBounds[1]+5){
                        scaleY= (newY-figBounds[1]) / (handlerPoint.y-figBounds[1]);
                        scaleX= (newX-figBounds[0]) / (handlerPoint.x-figBounds[0]);
                    }
                    break;
            }//end switch
            
            
            
            
            
            /*By default the NW, NE, SW and SE are scalling keeping the ratio
             *but you can use SHIFT to cause a free (no keep ratio) change
             *So, if no SHIFT pressed we force a "keep ration" resize
             **/
            if(!SHIFT_PRESSED && transX != 0 && transY != 0){//keep ratios, only affects ne/nw resize

                //if we are scaling along the x axis (West or East resize), with an arc(behaves like corner) then scale relative to x movement
                //TODO: what's the reason for this?
                if(this.getCursor()=="w-resize" || this.getCursor()=="e-resize"){
                    scaleY = scaleX;
                }
                else { //for everything else, scale based on y
                    scaleX = scaleY;
                }
            }

            
            //move the figure to origine and "unrotate" it
            var matrixToOrigin = Matrix.mergeTransformations(
                Matrix.translationMatrix(-oldCenter.x,-oldCenter.y),
                Matrix.rotationMatrix(-angle),
                Matrix.translationMatrix(oldCenter.x,oldCenter.y)
            );
                
//            HandleManager.figure.transform(Matrix.translationMatrix(-oldCenter.x,-oldCenter.y));
//            HandleManager.figure.transform(Matrix.rotationMatrix(-angle));
//            HandleManager.figure.transform(Matrix.translationMatrix(oldCenter.x,oldCenter.y));
//
//            //scale matrix
//            HandleManager.figure.transform(Matrix.translationMatrix(-transX, -transY));
//            HandleManager.figure.transform(Matrix.scaleMatrix(scaleX, scaleY))
//            HandleManager.figure.transform(Matrix.translationMatrix(transX, transY));
//
//
//            //move and rotate the figure back to its original coordinates
//            HandleManager.figure.transform(Matrix.translationMatrix(-oldCenter.x,-oldCenter.y));
//            HandleManager.figure.transform(Matrix.rotationMatrix(angle));
//            HandleManager.figure.transform(Matrix.translationMatrix(oldCenter.x,oldCenter.y));
//             HandleManager.figure.transform(directMatrix);            
            
            //scale matrix
            var scaleMatrix = Matrix.mergeTransformations(
                Matrix.translationMatrix(-transX, -transY),
                Matrix.scaleMatrix(scaleX, scaleY),
                Matrix.translationMatrix(transX, transY)
            );
                
            var unscaleMatrix = Matrix.mergeTransformations(
                Matrix.translationMatrix(-transX, -transY),
                Matrix.scaleMatrix(1/scaleX, 1/scaleY),
                Matrix.translationMatrix(transX, transY)
            );
                        
            //move and rotate the figure back to its original coordinates
             var matrixBackFromOrigin = Matrix.mergeTransformations(
                Matrix.translationMatrix(-oldCenter.x,-oldCenter.y),
                Matrix.rotationMatrix(angle),
                Matrix.translationMatrix(oldCenter.x,oldCenter.y)
            );
               
             var directMatrix = Matrix.mergeTransformations(matrixToOrigin, scaleMatrix, matrixBackFromOrigin);
             var reverseMatrix = Matrix.mergeTransformations(matrixToOrigin, unscaleMatrix, matrixBackFromOrigin);
             
             var cmdScale = new ScaleFigureCommand(HandleManager.figure.id, directMatrix, reverseMatrix);
             cmdScale.execute();
             History.addUndo(cmdScale);

                
            
        } //end else
        
        
    },

    /**
     *Handle actions for Connector
     *
     *@param {Array } lastMove - an array that will hold [x,y] of last x & y coordinates
     *@param {Number} newX - new X coordinate
     *@param {Number} newY - new Y coordinate
     **/
    actionConnector: function(lastMove, newX, newY){
        switch(this.type){
            case 'v':
                var index;
                //find the two turning points this handle is in between
                for(var i = 1; i < HandleManager.figure.turningPoints.length-1; i++){
                    if(HandleManager.figure.turningPoints[i-1].y == HandleManager.figure.turningPoints[i].y 
                        && HandleManager.figure.turningPoints[i].y == this.y 
                        && Math.min(HandleManager.figure.turningPoints[i].x, HandleManager.figure.turningPoints[i-1].x) <= this.x 
                        && Math.max(HandleManager.figure.turningPoints[i].x, HandleManager.figure.turningPoints[i-1].x) >= this.x)
                    {
                        index = i;
                    }
                }
                //Pick turning points neighbours and translate them on Oy
                HandleManager.figure.turningPoints[index-1].transform( Matrix.translationMatrix(0, newY - lastMove[1]) );
                HandleManager.figure.turningPoints[index].transform( Matrix.translationMatrix(0, newY - lastMove[1]) );
                break;

            case 'h':
                var index;
                //find the two turning points this handle is in between
                for(var i = 1; i < HandleManager.figure.turningPoints.length-1; i++){
                    if(HandleManager.figure.turningPoints[i-1].x == HandleManager.figure.turningPoints[i].x 
                        && HandleManager.figure.turningPoints[i].x == this.x 
                        && Math.min(HandleManager.figure.turningPoints[i].y, HandleManager.figure.turningPoints[i-1].y) <= this.y 
                        && Math.max(HandleManager.figure.turningPoints[i].y, HandleManager.figure.turningPoints[i-1].y) >= this.y)
                    {
                        index = i;
                    }
                }
                //Pick turning points neighbours and translate them on Ox
                HandleManager.figure.turningPoints[index-1].transform( Matrix.translationMatrix(newX-lastMove[0],0) );
                HandleManager.figure.turningPoints[index].transform( Matrix.translationMatrix(newX-lastMove[0],0) );
                break;
        }
        HandleManager.figure.updateMiddleText();
    },

    /**Handle an action. Simply dispatch to the correct handler
     *@param {Array } lastMove - an array that will hold [x,y] of last x & y coordinates
     *@param {Number} newX - new X coordinate
     *@param {Number} newY - new Y coordinate
     **/
    action: function(lastMove, newX, newY){
        if(lastMove == null || lastMove.length != 2){
            throw new Exception('Handle:action() Last move is wrong');
        }
        if(HandleManager.figure instanceof Connector){
            this.actionConnector(lastMove, newX, newY);
        }
        else{
            this.actionFigure(lastMove, newX, newY);
        }
    },


    /**This is the method you have to call to paint a handler
     * All handles will be circles...so we avoid to much of the computing for rectangle handles
     * They will have a filling color (green) and a stoke (black)
     * @param {Context} context - the 2D context
     **/
    paint : function(context){
        context.save();
        
        //fill the handler
        context.beginPath();
        context.arc(this.x, this.y, Handle.RADIUS, 0, Math.PI*2, false);
        context.fillStyle = "rgb(0,255,0)";
        context.closePath();
        context.fill();
        
        //stroke the handler
        context.beginPath();
        context.arc(this.x, this.y, Handle.RADIUS, 0, Math.PI*2, false);
        context.strokeStyle = "rgb(0,0,0)";
        context.closePath();
        context.stroke();

        
        if(this.type == 'r'){
            var line = new Line(new Point(this.x,this.y), new Point(HandleManager.handles[1].x,HandleManager.handles[1].y))
            line.style.dashLength = 3;
            line.style.strokeStyle="grey";
            line.paint(context);
        }
        
        context.restore();
    },


    /**See if the handle contains a point
     *@param {Number} x - the x coordinate of the point
     *@param {Number} y - the y coordinate of the point
     **/
    contains:function(x,y){
        var p=new Point(this.x,this.y);
        return p.near(x,y, Handle.RADIUS);
    },

    
    /**
     *Get a handle bounds
     **/
    getBounds : function(){
        return [this.x - Handle.RADIUS, this.y - Handle.RADIUS, this.x + Handle.RADIUS,this.y + Handle.RADIUS];
    },


    /** 
     *Transform the Handle through a matrix
     *@param {Matrix} matrix - the matrix that will perform the transformation
     **/
    transform: function(matrix){
        var p=new Point(this.x,this.y)
        p.transform(matrix);
        this.x=p.x;
        this.y=p.y;
    },
    

    /**Get the specific cursor for this handle. Cursor is ONLY a visual clue for
     *  the user to know how to move his mouse.
     *
     *Behaviour:
     * If North handle is in the North we have 'Up/Down arrow" cursor
     * If North handle is in the West (so it has "Left/Right arrow") (or anything different that North)
     *  we have 'Left/Right arrow' cursor but the figure will expand as follows:
     *  - rotate back to initial position
     *  - expand North
     *  - rotate back to current position
     *  - repaint
     * @see <a href="http://www.w3schools.com/css/pr_class_cursor.asp">http://www.w3schools.com/css/pr_class_cursor.asp</a> for cusor values
     * @author Zack Newsham <zack_newsham@yahoo.co.uk>
     * @author Alex Gheorghiu <alex@scriptoid.com>
     **/
    
    getCursor:function(){
        if(HandleManager.figure instanceof Connector){
            if(this.visible == false){
                return "";
            }
            if(this.type == 'v'){
                return 'ns-resize';
            }
            else{
                return 'ew-resize';
            }
        } //end if Connector
        else{
            if(this.visible == false){
                return "";
            }
            if(this.type == 'r'){
                return 'move';
            }
        
            var figureBounds = HandleManager.figure.getBounds(); //get figure's bounds
            var figureCenter = new Point(figureBounds[0] + ((figureBounds[2]-figureBounds[0])/2),
                (figureBounds[1] + ((figureBounds[3] - figureBounds[1])/2)) ); //get figure's center

            //find north
            var closestToNorthIndex = -1; //keeps the index of closest handle to North
            var minAngleToNorth = 2 * Math.PI; //keeps the smallest (angular) distante to North
            var myIndex = -1;

            for(var i=0; i<HandleManager.handles.length-1; i++){
                var handleCenter = new Point(HandleManager.handles[i].x, HandleManager.handles[i].y);
                var angle = Util.getAngle(figureCenter,handleCenter); //get the angle between those 2 points 0=n

                if(angle <= Math.PI){ //quadrant I or II
                    if(angle < minAngleToNorth){
                        minAngleToNorth = angle;
                        closestToNorthIndex = i;
                    }
                }
                else{ //quadrant III or IV
                    if(2 * Math.PI - angle < minAngleToNorth){
                        minAngleToNorth = 2 * Math.PI - angle
                        closestToNorthIndex = i;
                    }
                }
            }

           //alert("closest to North is : " + closestToNorthIndex);
           for(var k=0; k<8; k++){ //there will always be 8 resize handlers
               //we do not use modulo 9 as we want to ignore the "rotate" handle
               if(HandleManager.handles[(closestToNorthIndex + k) % 8] == this){
                    return Handle.types[k]+"-resize";
               }
           }
        } //end if Figure

        return "";
    }
}


/**HandleManager will act like a Singleton (even not defined as one)
 * You will attach a Figure to it and he will be in charge with the figure manipulation
 * @constructor
 * @this {HandleManager}
 **/
function HandleManager(){
}

/**The shape (figure or connector) that the HandleManager will manage*/
HandleManager.figure = null;

/**An {Array} with current handles*/
HandleManager.handles = [];

/**An {Array} with connector handles*/
HandleManager.connectorHandles = [];

/**Selection rectangle (the rectangle upon the Handles will stay in case of a Figure/Group)*/
HandleManager.selectRect = null;

/**Currently selected handle*/
HandleManager.handleSelectedIndex = -1;

/**Distance from shape where to draw the handles*/
HandleManager.handleOffset = 10;

/**Get selected handle or null if no handler selected*/
HandleManager.handleGetSelected = function(){
    if(HandleManager.handleSelectedIndex!=-1){
        return HandleManager.handles[HandleManager.handleSelectedIndex];
    }
    return null;
}

/**Use this method to set a new shape (Figure or Connetor)  to this manager.
 * Every time a new figure is set, old handles will dissapear (got erased by new figure's handles)
 **/
HandleManager.figureSet = function(shape){
    HandleManager.figure = shape;

    //1. clear old/previous handles
    HandleManager.handles = [];

    //2. setup/add handles for this figure
    if(shape instanceof Connector) {
        HandleManager.selectRect = null;
        
        //we don't want to affect the start or end points
        for(var i=1; i<shape.turningPoints.length-2; i++){
            var h;
            
            /*
             *Create a new handle ONLY if previous, current and next turning points are not colinear
             **/
            if( 
                /*Previous points are not colinear and next points are either non colinear or last 2 coincide (this case appear when dragging)*/
                (
                    ! Util.collinearity(HandleManager.figure.turningPoints[i-1], HandleManager.figure.turningPoints[i], HandleManager.figure.turningPoints[i+1])
                    && 
                    ( !Util.collinearity(HandleManager.figure.turningPoints[i], HandleManager.figure.turningPoints[i+1], HandleManager.figure.turningPoints[i+2])
                    || HandleManager.figure.turningPoints[i+1].equals(HandleManager.figure.turningPoints[i+2]) )
                )
            
            ||
                /*Previous points are non colinear or last 2 of them coincide and next points are not colinear*/
                (
                    (! Util.collinearity(HandleManager.figure.turningPoints[i-1], HandleManager.figure.turningPoints[i], HandleManager.figure.turningPoints[i+1])
                    || HandleManager.figure.turningPoints[i-1].equals(HandleManager.figure.turningPoints[i]) )
                    && 
                    !Util.collinearity(HandleManager.figure.turningPoints[i], HandleManager.figure.turningPoints[i+1], HandleManager.figure.turningPoints[i+2])
                )
            ){
                if(shape.turningPoints[i].x == shape.turningPoints[i+1].x){ //same vertical
                    h = new Handle("h");
                    h.x = HandleManager.figure.turningPoints[i].x;
                    h.y = (HandleManager.figure.turningPoints[i].y + HandleManager.figure.turningPoints[i+1].y) / 2;

                }
                else{ // same horizontal
                    h = new Handle("v");
                    h.x = (HandleManager.figure.turningPoints[i].x +  HandleManager.figure.turningPoints[i+1].x) / 2;
                    h.y = HandleManager.figure.turningPoints[i].y;
                }
                h.visible = true;
                HandleManager.handles.push(h);
            }
        }
    }
    else if(shape instanceof Figure || shape instanceof Group){
        //find Figure's angle
        var angle = Util.getAngle(HandleManager.figure.rotationCoords[0], HandleManager.figure.rotationCoords[1]);

        //rotate it back to "normal" space (from current space)
        HandleManager.figure.transform(Matrix.rotationMatrix(-angle), false);
        HandleManager.selectRect = new Polygon();

        //construct bounds of the Figure in "normal" space
        var bounds = HandleManager.figure.getBounds();
        HandleManager.selectRect.points = [];
        HandleManager.selectRect.addPoint(new Point(bounds[0] - HandleManager.handleOffset, bounds[1] - HandleManager.handleOffset)); //top left
        HandleManager.selectRect.addPoint(new Point(bounds[2]+ HandleManager.handleOffset, bounds[1] - HandleManager.handleOffset)); //top right
        HandleManager.selectRect.addPoint(new Point(bounds[2] + HandleManager.handleOffset, bounds[3] + HandleManager.handleOffset)); //bottom right
        HandleManager.selectRect.addPoint(new Point(bounds[0] - HandleManager.handleOffset, bounds[3] + HandleManager.handleOffset)); //bottom left

        bounds = HandleManager.selectRect.getBounds();

        //update current handles
        var handle = new Handle("nw"); //NW
        handle.x = bounds[0];
        handle.y = bounds[1];
        HandleManager.handles.push(handle);

        handle = new Handle("n"); //N
        handle.x = bounds[0]+(bounds[2]-bounds[0])/2;
        handle.y = bounds[1];
        HandleManager.handles.push(handle);

        handle = new Handle("ne"); //NE
        handle.x = bounds[2];
        handle.y = bounds[1];
        HandleManager.handles.push(handle);

        handle = new Handle("e"); //E
        handle.x = bounds[2];
        handle.y = bounds[1]+(bounds[3]-bounds[1])/2;
        HandleManager.handles.push(handle);

        handle = new Handle("se"); //SE
        handle.x = bounds[2];
        handle.y = bounds[3];
        HandleManager.handles.push(handle);

        handle = new Handle("s"); //S
        handle.x = bounds[0]+(bounds[2]-bounds[0])/2;
        handle.y = bounds[3];
        HandleManager.handles.push(handle);

        handle = new Handle("sw"); //SW
        handle.x = bounds[0];
        handle.y = bounds[3];
        HandleManager.handles.push(handle);

        handle = new Handle("w"); //W
        handle.x = bounds[0];
        handle.y = bounds[1]+(bounds[3]-bounds[1])/2;
        HandleManager.handles.push(handle);


        handle = new Handle("r"); //Rotation
        handle.x = bounds[0]+(bounds[2]-bounds[0])/2;
        handle.y = bounds[1] - HandleManager.handleOffset * 1.5;
        HandleManager.handles.push(handle);


        HandleManager.selectRect.transform(Matrix.rotationMatrix(angle));

        //rotate figure from "normal" space to current space
        HandleManager.figure.transform(Matrix.rotationMatrix(angle),false);
        if(shape instanceof Figure){
            if(shape.primitives[0] instanceof Text && shape.primitives.length == 1){
                for(var i = 0; i < HandleManager.handles.length-1; i++){
                    HandleManager.handles[i].visible = false;
                }
            }
        }
        //now transform the handles from "normal" space too
        for(var i=0; i<HandleManager.handles.length; i++){
            HandleManager.handles[i].transform(Matrix.rotationMatrix(angle));
        }
    }
}

/**Returns all handles for a shape (figure or connector).
 *It does not mean that the HandleManager keeps records of all Handles for a
 *Figure but more likely they are computed on-the-fly
 *@return an {Array} of {Handle} that you can further use to manage the figure
 **/
HandleManager.handleGetAll = function(){
    return HandleManager.handles;
}

/**Returns the handle from a certain coordinates
 *@param {Number} x - the value on Ox
 *@param {Number} y - the value on Oy
 ***/
HandleManager.handleGet = function(x,y){
    for(var i=0; i<HandleManager.handles.length; i++){
        if(HandleManager.handles[i].contains(x,y)){
            return HandleManager.handles[i];
        }
    }
    return null;
}

/**
 *Select the handle from a certain coodinates
 *@param {Number} x - the value on Ox
 *@param {Number} y - the value on Oy
 **/
HandleManager.handleSelectXY = function(x,y){
    HandleManager.handleSelectedIndex=-1;
    for (var i=0; i<HandleManager.handles.length; i++){
        if(HandleManager.handles[i].contains(x,y)){
            HandleManager.handleSelectedIndex = i;
        }
    }
}

/**
 *Clear HandleManager.
 **/
HandleManager.clear = function(){
    HandleManager.handleSelectedIndex = -1;
    HandleManager.figure = null;
    HandleManager.handles = [];
}

/**Paint the Handles, actually the HandleManager will delegate each paint to
 *the proper Handle to paint
 *@param {Context} context - the 2D context
 **/
HandleManager.paint = function(context){
    var handles = HandleManager.handleGetAll(); //calling this sets the coordinates

    //paint first the selection rectanle
    context.save();

    //paint selection rectagle (if present - only for Figure and Group)
    if(HandleManager.selectRect != null){
        //alert("Handle manager paint!");
        HandleManager.selectRect.style.strokeStyle = "grey";
        HandleManager.selectRect.paint(context);
    }

    //now paint handles
    for(var i=0; i<handles.length; i++){
        if(handles[i].visible == true){
            handles[i].paint(context);
        }
    }
    context.restore()
}