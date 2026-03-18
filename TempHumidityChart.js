
// Uses D3 to manipulate the DOM and make chart drawing

// Placing these outside and functions like this places them in global scope
var temperatureTooltip;
var temperatureData;
var tooltipPara;
var dow = ["Sun", "Mon", "Tue", "Wed", "Thur", "Fri", "Sat"];

// Cvt CSV data string, with headers, to a data array suitable for D3
function csvDataToArray(csv) {
    const lines = csv.split('\n'); // Split the string into lines by the newline character
    const headers = lines[0].split(','); // Extract the first line as headers
    const result = [];

    // Iterate over the remaining lines (data rows)
    for (let i = 1; i < lines.length - 1; i++) {
        const obj = {};
        const currentLine = lines[i].split(','); // Split the current line by commas

        // Map the data cells to the header keys
        for (let j = 0; j < headers.length; j++) {
            // Assign the value to the corresponding header key
            // trim() helps handle potential whitespace around headers/values
            // The null check deals with missing values.
            val = currentLine[j];
            obj[headers[j].trim()] = (val != null) ? val.trim() : null;
        }

        result.push(obj); // Add the new object to the result array
    }
    return result;
}

function TempHumidityChart(theDivID, theData) {

    if (theData.length <= 1)
        return;

    var theDiv = d3.select(theDivID);

    // CVT data from CSV to array
    temperatureData = csvDataToArray(theData);

    // CVT Strings to other datatypes
    // Calc min and max for Y axis
    var yMin = 999, yMax = -1;
    const parseDT = d3.timeParse("%Y-%m-%d %H:%M"); // Use D3's parser for DT values
    temperatureData.forEach(function (value, index, array) {
        array[index].DT = parseDT(value.DT);
        var val = array[index].Value = Number(value.Value);
        yMin = Math.min(yMin, val);
        yMax = Math.max(yMax, val);
        array[index].WasOff = Number(value.WasOff);
    })

    // Set the dimensions and margins of the graph
    var margin = { top: 10, right: 3, bottom: 20, left: 30 },
        width = 600 - margin.left - margin.right,
        height = 300 - margin.top - margin.bottom;

    // Append the svg object within the specified div
    // along with the primary g element.
    const svg = theDiv // https://d3js.org/d3-selection/selecting
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);
    const graphG = svg.append("g")
        .attr("id", "TempG")
        .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");

    //
    // Add X axis --> for the extent of dates in tempData
    //
    const xScale = d3.scaleTime();                  // A D3 scaler
    const extent = d3.extent(temperatureData,       // Let D3 calculate extent
        function (d) { return d.DT; });
    // Stretch the extent a bit, helps with X margin apperance
    // FYI: the extent array has references to data elements rather
    // than copies. MAke a new Date so as to not mess with the original data.
    extent[0] = new Date(extent[0]);
    extent[0].setHours(extent[0].getHours() - 3); // Stretch out a bit, helps
    extent[1] = new Date(extent[1]);
    extent[1].setHours(extent[1].getHours() + 3); // with chart X margin
    xScale.domain(extent)
        .range([0, width]);
    const xAxis = d3.axisBottom(xScale)
        .ticks(7);
    graphG.append("g")
        .style("font-size", "12px")
        .attr("transform", `translate(0, ${height})`)
        .call(xAxis);

    // Y axis
    const yScale = d3.scaleLinear()
        .domain([yMin - 2, yMax + 2]) // +-2, bit of extra space
        .range([height, 0]);
    graphG.append("g")
        .style("font-size", "14px")
        .call(d3.axisLeft(yScale));

    colorMap = new Map([
        [0, { label: "PWR on", color: "steelblue" }],
        [1, { label: "PWR was off", color: "red" }],
    ]);

    // Line generator, supplies coords from data for the line segments
    var d3Line = d3.line()
        .x(function (d) { return xScale(d.x) })
        .y(function (d) { return yScale(d.y) });

    // Look as though there is no straight-forward means to gen <path>s
    // with different color segments. So this'll generate path in segments
    // of runs of the same color.
    var lastCategory = temperatureData[1].WasOff; // No need for transition between 0 and 1
    var dataArray = [{ "x": temperatureData[0].DT, "y": temperatureData[0].Value }];
    for (i = 1; i < temperatureData.length; i++) {

        var category = temperatureData[i].WasOff;

        if (category != lastCategory) {
            // Render path up to this point
            graphG.append("path")
                .datum(dataArray)
                .attr("fill", "none")
                .attr("stroke", colorMap.get(lastCategory).color)
                .attr("stroke-width", 1.5)
                .attr("d", d3Line)

            dataArray = [];
            lastCategory = category;
            // Starting point for next segment
            dataArray.push({ "x": temperatureData[i - 1].DT, "y": temperatureData[i - 1].Value });
        }
        dataArray.push({ "x": temperatureData[i].DT, "y": temperatureData[i].Value });
    }

    // Add the last segment, if there is one.
    if (dataArray.length > 0)
        graphG.append("path")
            .datum(dataArray)
            .attr("fill", "none")
            .attr("stroke", colorMap.get(lastCategory).color)
            .attr("stroke-width", 1.5)
            .attr("d", d3Line)

    // <div> for the tooltip
    temperatureTooltip = theDiv
        .append("div")
        .style("position", "absolute")
        .style("visibility", "hidden")
        .style("background-color", "white")
        .style("border-style", "solid")
        .style("border-width", "1px");

    tooltipPara = temperatureTooltip
        .append("p")
        .style("margin-left", "3px")
        .style("margin-right", "3px")
        .style("margin-bottom", "3px")
        .style("margin-top", "3px")
        .style("font-family", "Arial")
        .text("Tooltip");

    // Circles at the data points
    var symbolsG = graphG.append("g");
    for (var i = 0; i < temperatureData.length; i++) {
        var d = temperatureData[i];
        var category = d.WasOff;
        var circle = symbolsG.append('circle')
            .attr("id", i.toString()) // For finding temperatureData element in events
            .attr("cx", xScale(d.DT))
            .attr("cy", yScale(d.Value))
            .attr("r", 4)
            .attr("stroke", "black")
            .attr("fill", colorMap.get(category).color);
        // Tooltip for circle
        circle.attr("onmouseover", "OnMouseOver(this, event)")
            .attr("onmousemove", "OnMouseMove(this)")
            .attr("onmouseleave", "OnMouseOut(this)");
    }
}

function OnMouseOver(circle, event) {

    temperatureTooltip.style("visibility", "visible");
    temperatureTooltip.style("top", event.y - 20 + "px").style("left", event.x + 20 + "px");

    var i = circle.id;
    var element = temperatureData[i];
    var aDT = element.DT;
    // Make a DT string mm-dd-yyyy hh:mm (24 hr time)
    // Apparently no builtin DT formatting stuff in JS.
    var aDT_Str =
        "<br>"
        + dow[aDT.getDay()]
        + " "
        + (1 + aDT.getMonth()).toString().padStart(2, '0')
        + "-"
        + aDT.getDate().toString().padStart(2, '0')
        + "-"
        + aDT.getFullYear().toString()
        + " "
        + (1 + aDT.getHours()).toString().padStart(2, '0')
        + ":"
        + aDT.getMinutes().toString().padStart(2, '0')
        ;

    // Set red "power was off before this reading" string
    var powerOffStr = "";
    if (element.WasOff)
        powerOffStr = '<br><span style="color:red;">Power off b4 this reading</span>';

    var aStr = element.Value.toString() + " F"
        + aDT_Str
        + powerOffStr
        ;

    tooltipPara.html(aStr);
}

function OnMouseMove(circle) {
} // tooltip.style("top", (offsetY - 30) + "px").style("left", (event.offsetX + 10) + "px")

function OnMouseOut(circle) {
    temperatureTooltip.style("visibility", "hidden");
}
