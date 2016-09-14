//----------------------------------------------------------------------------
//
//  Helper functions
//

function hexToR(h) {return parseInt((cutHex(h)).substring(0,2),16)}
function hexToG(h) {return parseInt((cutHex(h)).substring(2,4),16)}
function hexToB(h) {return parseInt((cutHex(h)).substring(4,6),16)}
function cutHex(h) {return (h.charAt(0)=="#") ? h.substring(1,7):h}

function hexToRGB(strcol)
{
    var color = vec3(1.0, 1.0, 1.0);
    color[0] = hexToR(strcol) / 255;
    color[1] = hexToG(strcol) / 255;
    color[2] = hexToB(strcol) / 255;
    return color;
}

//----------------------------------------------------------------------------

function rgbToHex(R,G,B) { return '#'+toHex(R)+toHex(G)+toHex(B); }
function toHex(n)
{
   n = (255 * n).toFixed();
   n = Math.max(0,Math.min(n,255));
   return "0123456789ABCDEF".charAt((n-n%16)/16)
        + "0123456789ABCDEF".charAt(n%16);
}

function queryToRGB(qstr)
{
   return qstr.split(',').map(
   	   function(x) {return parseInt(x) / 255;}
   );
}

function rgbToQuery(color)
{
   return color.map(function(x){ return (255 * x).toFixed(); }).join(',');
}

//----------------------------------------------------------------------------

/**
 * Get the value of a querystring
 * @param  {String} field The field to get the value of
 * @param  {String} url   The URL to get the value from (optional)
 * @return {String}       The field value
 */
function getQueryString(field, url)
{
    var href = url ? url : window.location.href;
    var reg = new RegExp('[?&#]' + field + '=([^&#]*)', 'i');
    var string = reg.exec(href);
    return string ? string[1] : null;
};
