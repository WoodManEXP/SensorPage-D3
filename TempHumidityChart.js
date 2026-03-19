
// Uses D3 to manipulate the DOM and make chart drawing

// Placing these outside and functions like this places them in global scope
var tooltip;
var dataArray;
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

function TempHumidityChart(temperatureDivID, humidityDivID, theData) {

    if (theData.length <= 1)
        return;

    var temperatureDiv = d3.select(temperatureDivID);
    var humidityDiv = d3.select(humidityDivID);

    colorMap = new Map([
        [0, { label: "PWR on", color: "steelblue" }],
        [1, { label: "PWR was off", color: "red" }],
    ]);

    // CVT data from CSV to array
    dataArray = csvDataToArray(theData);

    // CVT Strings to other datatypes
    // Calc min and max for Y axis
    var yMinTemperature = 999, yMaxTemperature = -1;
    var yMinHumidity = 999, yMaxHumidity = -1;
    const parseDT = d3.timeParse("%Y-%m-%d %H:%M"); // Use D3's parser for DT values
    dataArray.forEach(function (value, index, array) {
        array[index].DT = parseDT(value.DT);
        var val = array[index].Temperature = Number(value.Temperature);
        yMinTemperature = Math.min(yMinTemperature, val);
        yMaxTemperature = Math.max(yMaxTemperature, val);
        val = array[index].Humidity = Number(value.Humidity);
        yMinHumidity = Math.min(yMinHumidity, val);
        yMaxHumidity = Math.max(yMaxHumidity, val);
        array[index].WasOff = Number(value.WasOff);
    })

    // Set the dimensions and margins of the graph
    var margin = { top: 10, right: 3, bottom: 20, left: 30 },
        width = 800 - margin.left - margin.right,
        height = 250 - margin.top - margin.bottom;

    // Append the svg object within the specified div
    // along with the primary g element.
    var svg = temperatureDiv // https://d3js.org/d3-selection/selecting
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);
    var temperatureG = svg.append("g")
        .attr("id", "TemperatureG")
        .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");

    svg = humidityDiv // https://d3js.org/d3-selection/selecting
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);
    var humidityG = svg.append("g")
        .attr("id", "HumidityG")
        .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");

    // <div> and <p> for the tooltips
    tooltip = temperatureDiv
        .append("div")
        .style("position", "absolute")
        .style("visibility", "hidden")
        .style("background-color", "white")
        .style("border-style", "solid")
        .style("border-width", "1px");

    tooltipPara = tooltip
        .append("p")
        .style("font-size", "12px")
        .style("margin-left", "3px")
        .style("margin-right", "3px")
        .style("margin-bottom", "3px")
        .style("margin-top", "3px")
        .style("font-family", "Arial")
        .text("Tooltip");

    //
    // Add X axis --> for the extent of dates in tempData
    //
    const xScale = d3.scaleTime();            // A D3 scaler
    const extent = d3.extent(dataArray,       // Let D3 calculate extent
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
    temperatureG.append("g")
        .style("font-size", "12px")
        .attr("transform", `translate(0, ${height})`)
        .call(xAxis);

    // Temperature chart

    // Y axis
    var yScale = d3.scaleLinear()
        .domain([yMinTemperature - 2, yMaxTemperature + 2]) // +-2, bit of extra space
        .range([height, 0]);
    temperatureG.append("g")
        .style("font-size", "14px")
        .call(d3.axisLeft(yScale));

    // Line generator, supplies coords from data for the line segments
    var d3Line = d3.line()
        .x(function (d) { return xScale(d.x) })
        .y(function (d) { return yScale(d.y) });

    // Look as though there is no straight-forward means to gen <path>s
    // with different color segments. So this'll generate path in segments
    // of runs of the same color.
    var lastCategory = dataArray[1].WasOff; // No need for transition between 0 and 1
    var pathArray = [{ "x": dataArray[0].DT, "y": dataArray[0].Temperature }];
    for (i = 1; i < dataArray.length; i++) {

        var category = dataArray[i].WasOff;

        if (category != lastCategory) {
            // Render path up to this point
            temperatureG.append("path")
                .datum(pathArray)
                .attr("fill", "none")
                .attr("stroke", colorMap.get(lastCategory).color)
                .attr("stroke-width", 1.5)
                .attr("d", d3Line)

            pathArray = [];
            lastCategory = category;
            // Starting point for next segment
            pathArray.push({ "x": dataArray[i - 1].DT, "y": dataArray[i - 1].Temperature });
        }
        pathArray.push({ "x": dataArray[i].DT, "y": dataArray[i].Temperature });
    }

    // Add the last segment, if there is one.
    if (pathArray.length > 0)
        temperatureG.append("path")
            .datum(pathArray)
            .attr("fill", "none")
            .attr("stroke", colorMap.get(lastCategory).color)
            .attr("stroke-width", 1.5)
            .attr("d", d3Line)

    // Circles at the data points
    var symbolsG = temperatureG.append("g");
    for (var i = 0; i < dataArray.length; i++) {
        var d = dataArray[i];
        var category = d.WasOff;
        var circle = symbolsG.append('circle')
            .attr("id", i.toString()) // For finding temperatureData element in events
            .attr("cx", xScale(d.DT))
            .attr("cy", yScale(d.Temperature))
            .attr("r", 3)
            .attr("stroke", "black")
            .attr("fill", colorMap.get(category).color)
            .attr("data-torh", "t");
        // Tooltip for circle
        circle.attr("onmouseover", "OnMouseOver(this, event)")
            .attr("onmousemove", "OnMouseMove(this)")
            .attr("onmouseleave", "OnMouseOut(this)");
    }

    // Humidity chart

    // X axis (duplicate of temperature chart X axis)
    humidityG.append("g")
        .style("font-size", "12px")
        .attr("transform", `translate(0, ${height})`)
        .call(xAxis);

    // Y axis
    yScale = d3.scaleLinear()
        .domain([yMinHumidity - 2, yMaxHumidity + 2]) // +-2, bit of extra space
        .range([height, 0]);
    humidityG.append("g")
        .style("font-size", "14px")
        .call(d3.axisLeft(yScale));

    // Look as though there is no straight-forward means to gen <path>s
    // with different color segments. So this'll generate path in segments
    // of runs of the same color.
    lastCategory = dataArray[1].WasOff; // No need for transition between 0 and 1
    pathArray = [{ "x": dataArray[0].DT, "y": dataArray[0].Humidity }];
    for (i = 1; i < dataArray.length; i++) {

        var category = dataArray[i].WasOff;

        if (category != lastCategory) {
            // Render path up to this point
            humidityG.append("path")
                .datum(pathArray)
                .attr("fill", "none")
                .attr("stroke", colorMap.get(lastCategory).color)
                .attr("stroke-width", 1.5)
                .attr("d", d3Line)

            pathArray = [];
            lastCategory = category;
            // Starting point for next segment
            pathArray.push({ "x": dataArray[i - 1].DT, "y": dataArray[i - 1].Humidity });
        }
        pathArray.push({ "x": dataArray[i].DT, "y": dataArray[i].Humidity });
    }

    // Add the last segment, if there is one.
    if (pathArray.length > 0)
        humidityG.append("path")
            .datum(pathArray)
            .attr("fill", "none")
            .attr("stroke", colorMap.get(lastCategory).color)
            .attr("stroke-width", 1.5)
            .attr("d", d3Line)

    // Circles at the data points
    symbolsG = humidityG.append("g");
    for (var i = 0; i < dataArray.length; i++) {
        var d = dataArray[i];
        var category = d.WasOff;
        var circle = symbolsG.append('circle')
            .attr("id", i.toString()) // For finding temperatureData element in events
            .attr("cx", xScale(d.DT))
            .attr("cy", yScale(d.Humidity))
            .attr("r", 3)
            .attr("stroke", "black")
            .attr("fill", colorMap.get(category).color)
            .attr("data-torh", "h");
        // Tooltip for circle
        circle.attr("onmouseover", "OnMouseOver(this, event)")
            .attr("onmousemove", "OnMouseMove(this)")
            .attr("onmouseleave", "OnMouseOut(this)");
    }

}
function OnMouseOver(circle, event) {

    tooltip.style("visibility", "visible");
    tooltip.style("top", event.y - 20 + "px").style("left", event.x + 20 + "px");

    var i = circle.id;
    var element = dataArray[i];
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

    var aStr;
    if (circle.getAttribute("data-torh") == "t")
        aStr = element.Temperature.toString() + "F ";
    else
        aStr = element.Humidity.toString() + "% ";

    aStr += aDT_Str + powerOffStr;

    tooltipPara.html(aStr);
}
function OnMouseMove(circle) {
} // tooltip.style("top", (offsetY - 30) + "px").style("left", (event.offsetX + 10) + "px")

function OnMouseOut(circle) {
    tooltip.style("visibility", "hidden");
}
