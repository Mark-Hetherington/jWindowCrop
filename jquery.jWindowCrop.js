
/*
 * jWindowCrop v1.0.0
 *
 * Copyright (c) 2012 Tyler Brown
 * Licensed under the MIT license.
 *
 */

(function($){
	function fillContainer(val, targetLength, containerLength) { // ensure that no gaps are between target's edges and container's edges
		if(val + targetLength < containerLength) val = containerLength-targetLength;
		if(val > 0) val = 0;
		return val;
	}

	$.jWindowCrop = function(image, options){
		var base = this;
		base.$image = $(image); // target image jquery element
		base.originalHeight = base.$image.css('height');
		base.originalWidth = base.$image.css('width');
		base.image = image; // target image dom element
		base.$image.data("jWindowCrop", base); // target frame jquery element

		base.namespace = 'jWindowCrop';
		base.originalWidth = 0;
		base.isDragging = false;
		
		base.init = function(){
			base.$image.css({display:'none'}); // hide image until loaded
			base.options = $.extend(true,{},$.jWindowCrop.defaultOptions, options);
			if(base.options.zoomSteps < 2) base.options.zoomSteps = 2;

			base.$image.addClass('jwc_image').wrap('<div class="jwc_frame" />'); // wrap image in frame
			base.$frame = base.$image.parent();
			base.$frame.append('<div class="jwc_loader">' + base.options.loadingText + '</div>');
			if (base.options.overlayImage) {
				base.$overlay = $('<img class="jwc_overlay" src="'+ base.options.overlayImage +'" width="'+ base.options.targetWidth +'" height="'+ base.options.targetHeight +'" alt="" />');
				base.$frame.append(base.$overlay);
			}
			base.$frame.append('<div class="jwc_controls" style="display:'+(base.options.showControlsOnStart ? 'block' : 'none')+';"><span class="helptext">' + base.options.helptext + '</span></div>');
			if (base.options.controlsInset) {
				base.$frame.css({'overflow': 'hidden', 'position': 'relative', 'width': base.options.targetWidth, 'height': base.options.targetHeight});
			} else {
				if (base.$frame.find('.jwc_controls').height())
					base.$frame.css({'overflow': 'hidden', 'position': 'relative', 'width': base.options.targetWidth+'px', 'height': base.options.targetHeight+base.$frame.find('.jwc_controls').height()})
				else 
					base.$frame.css({'overflow': 'hidden', 'position': 'relative', 'width': base.options.targetWidth+'px', 'height': base.options.targetHeight+26})//A default height.
			}
			base.$image.css({'position': 'absolute', 'top': '0px', 'left': '0px'});

			//Add custom buttons to default buttons array.
			$.merge(base.options.buttons,base.options.customButtons);
			$.each(base.options.buttons,function (i,button){
				base.$frame.find('.jwc_controls').append('<a href="#" class="'+button.class+'" title="'+button.name+'">' + ((button.content) ? button.content : '')+ '</a>');
				if (button.function && base[button.function]) { //Bind function to button.
					base.$frame.find('.'+button.class).on('click.'+base.namespace, base[button.function]);
				} else if (button.handler){
					base.$frame.find('.'+button.class).on('click.'+base.namespace,button.handler);
				}
			});
			base.$frame.on('mouseenter.'+base.namespace, handleMouseEnter);
			base.$frame.on('mouseleave.'+base.namespace, handleMouseLeave);
			if (base.$image.imagesLoaded) {
				base.$image.imagesLoaded(handleImageLoad); //Use https://github.com/desandro/imagesloaded if available
			}else {
				base.$image.on('load.'+base.namespace, handleImageLoad);
			}
			if (base.options.overlayImage) {
				base.$overlay.on('mousedown.'+base.namespace, handleMouseDown);
			} else {
				base.$image.on('mousedown.'+base.namespace, handleMouseDown);
			}
			$(document).on('mousemove.'+base.namespace, handleMouseMove);
			$(document).on('mouseup.'+base.namespace, handleMouseUp);
		};

		base.destroy = function() {
			base.$image.removeData("jWindowCrop");         // remove data
			$(document).off('mouseup.'+base.namespace);    // remove body binds
			$(document).off('mousemove.'+base.namespace);  // remove body binds
			base.$image.off('mousedown.'+base.namespace);  // remove image binds
			if (base.$overlay) base.$overlay.unbind();     //remove overlay binds
			base.$image.off('load.'+base.namespace);       // remove image binds
			base.$frame.off('mouseleave.'+base.namespace); // remove frame binds
			base.$frame.off('mouseenter.'+base.namespace); // remove frame binds
			$.each(base.options.buttons,function (i,button){
				base.$frame.find('.jwc_controls').unbind();// remove button triggers
			});
			$('.jwc_loader').remove();         // remove the added text
			$('.jwc_controls').remove();       // remove the added controls
			base.$image.removeAttr( 'style' ); // undo the style
			base.$image.unwrap();              // undo the wrap
		};
		
		base.setZoom = function(percent) {
			if(base.minPercent >= 1) {
				percent = base.minPercent;
			} else if(percent > 1.0) {
				percent = 1;
			} else if(percent < base.minPercent) {
				percent = base.minPercent;	
			}
			base.$image.width(Math.ceil(base.originalWidth*percent));
			base.$image.height(Math.ceil(base.originalHeight*percent));
			base.workingPercent = percent;
			focusOnCenter();
			updateResult();
		};
		base.zoomIn = function() {
			var zoomIncrement = (1.0 - base.minPercent) / (base.options.zoomSteps-1);
			base.setZoom(base.workingPercent+zoomIncrement);
			return false;
		};
		base.zoomOut = function() {
			var zoomIncrement = (1.0 - base.minPercent) / (base.options.zoomSteps-1);
			base.setZoom(base.workingPercent-zoomIncrement);
			return false;
		};
		base.reset = function() {
			base.originalWidth = 0;
			base.originalHeight = 0;
			base.options.cropX = null;
			base.options.cropY = null;
			base.options.cropW = null;
			base.options.cropH = null;
			base.workingPercent = null;
			base.$image.width('');
			base.$frame.css({'width': base.options.targetWidth, 'height': base.options.targetHeight});
			initializeDimensions();
		};	

		function initializeDimensions() {
			if(base.originalWidth == 0) {
				base.originalWidth = base.$image.width();
				base.originalHeight = base.$image.height();
			}
			if(base.originalWidth > 0) {
				if (base.options.controlsInset) { //Height might not have been set accurately. Try again now.
					if (base.$frame.find('.jwc_controls').height())
						base.$frame.css({'overflow': 'hidden', 'position': 'relative', 'width': base.options.targetWidth+'px', 'height': base.options.targetHeight+base.$frame.find('.jwc_controls').height()});
				}
				// first calculate the "all the way zoomed out" position
				// this should always still fill the frame so there's no blank space.
				// this will be the value you're never allowed to get lower than.
				var widthRatio = base.options.targetWidth / base.originalWidth;
				var heightRatio = base.options.targetHeight / base.originalHeight;
				if(widthRatio >= heightRatio) {
					base.minPercent = (base.originalWidth < base.options.targetWidth) ? (base.options.targetWidth / base.originalWidth) : widthRatio;
				} else {
					base.minPercent = (base.originalHeight < base.options.targetHeight) ? (base.options.targetHeight / base.originalHeight) : heightRatio;
				}

				// now if they've set initial width and height, calculate the
				// starting zoom percentage. 
				if (base.options.cropW!==null && base.options.cropW!=='' && base.options.cropH!==null && base.options.cropH!=='') {
					widthRatio = base.options.targetWidth / base.options.cropW;
					heightRatio = base.options.targetHeight / base.options.cropH;
					if(widthRatio >= heightRatio) {
						var cropPercent = (base.originalWidth < base.options.targetWidth) ? (base.options.targetWidth / base.originalWidth) : widthRatio;
					} else {
						var cropPercent = (base.originalHeight < base.options.targetHeight) ? (base.options.targetHeight / base.originalHeight) : heightRatio;
					}
				}
				// If they didn't specify anything then use the above "all the
				// way zoomed out" value.
				else {
					var cropPercent = base.minPercent;
				}

				// for the initial zoom we'll just jump into the center of the image.
				base.focalPoint = {'x': Math.round(base.originalWidth/2), 'y': Math.round(base.originalHeight/2)};
				base.setZoom(cropPercent);

				// now if presets x&y have been passed, then we have to slide over 
				// to the new position after zooming. Why after? because the initial
				// position might not be valid until after we zoom...
				if (base.options.cropX!==null && base.options.cropX!==''
					&& base.options.cropY!==null && base.options.cropY!==''
					&& base.options.cropW!==null && base.options.cropW!==''
					&& base.options.cropH!==null && base.options.cropH!=='') {
					base.$image.css({'left' : (Math.floor(parseInt(base.options.cropX)*base.workingPercent*-1)+'px'), 'top' : (Math.floor(parseInt(base.options.cropY)*base.workingPercent*-1)+'px')});
					storeFocalPoint();
					// make sure we notify the onChange function about this...
					updateResult();
				}
				base.$frame.find('.jwc_loader').remove();   // remove the added text
				// now that we've loaded and positioned the image, we can display it
				base.$image.fadeIn('fast'); 
			}
		}
		function storeFocalPoint() {
			var x = (parseInt(base.$image.css('left'))*-1 + base.options.targetWidth/2) / base.workingPercent;
			var y = (parseInt(base.$image.css('top'))*-1 + base.options.targetHeight/2) / base.workingPercent;
			base.focalPoint = {'x': Math.round(x), 'y': Math.round(y)};
		}
		function focusOnCenter() {
			var left = fillContainer((Math.round((base.focalPoint.x*base.workingPercent) - base.options.targetWidth/2)*-1), base.$image.width(), base.options.targetWidth);
			var top = fillContainer((Math.round((base.focalPoint.y*base.workingPercent) - base.options.targetHeight/2)*-1), base.$image.height(), base.options.targetHeight);
			base.$image.css({'left': (left.toString()+'px'), 'top': (top.toString()+'px')})
			storeFocalPoint();
		}
		function updateResult() {
			base.result = {
				cropX: Math.floor(parseInt(base.$image.css('left'))/base.workingPercent*-1),
				cropY: Math.floor(parseInt(base.$image.css('top'))/base.workingPercent*-1),
				cropW: Math.round(base.options.targetWidth/base.workingPercent),
				cropH: Math.round(base.options.targetHeight/base.workingPercent),
				mustStretch: (base.minPercent > 1)
			};
			base.options.onChange.call(base.image, base.result);
		}
		function handleImageLoad() {
			initializeDimensions();
		}
		function handleMouseDown(event) {
			event.preventDefault(); //some browsers do image dragging themselves
			base.isDragging = true;
			base.dragMouseCoords = {x: event.pageX, y: event.pageY};
			base.dragImageCoords = {x: parseInt(base.$image.css('left')), y: parseInt(base.$image.css('top'))}
		}
		function handleMouseUp() {
			base.isDragging = false;
		}
		function handleMouseMove(event) {
			if(base.isDragging) {
				var xDif = event.pageX - base.dragMouseCoords.x;
				var yDif = event.pageY - base.dragMouseCoords.y;
				var newLeft = fillContainer((base.dragImageCoords.x + xDif), base.$image.width(), base.options.targetWidth);
				var newTop = fillContainer((base.dragImageCoords.y + yDif), base.$image.height(), base.options.targetHeight);
				base.$image.css({'left' : (newLeft.toString()+'px'), 'top' : (newTop.toString()+'px')});
				storeFocalPoint();
				updateResult();
			}
		}
		function handleMouseEnter() {
			if(base.options.smartControls) base.$frame.find('.jwc_controls').fadeIn('fast');
		}
		function handleMouseLeave() {
			if(base.options.smartControls) base.$frame.find('.jwc_controls').fadeOut('fast');
		}
		
		base.init();
	};
	
	$.jWindowCrop.defaultOptions = {
		targetWidth: 320,
		targetHeight: 180,
		zoomSteps: 10,
		loadingText: 'Loading...',
		smartControls: true,
		controlsInset:true,
		showControlsOnStart: true,
		cropX: null,
		cropY: null,
		cropW: null,
		cropH: null,
		onChange: function() {},
		buttons: [{class:'jwc_zoom_in',name:'Zoom In', function:'zoomIn'},{class:'jwc_zoom_out',name:'Zoom Out', function:'zoomOut'}],
		customButtons:[],
		helptext:'Click to drag',
		overlayImage : null
	};
	
	$.fn.jWindowCrop = function(options){
		return this.each(function(){
			(new $.jWindowCrop(this, options));
		});
	};
	
	$.fn.getjWindowCrop = function(){
		return this.data("jWindowCrop");
	};
})(jQuery);

