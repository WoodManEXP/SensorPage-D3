
// Uses D3 to manipulate the DOM and make chart drawing

// Placing these outside and functions like this places them in global scope
var tooltip;
var tempHumidityDataArray, upDownDataArray;
var tooltipPara;
var dow = ["Sun", "Mon", "Tue", "Wed", "Thur", "Fri", "Sat"];

// Cvt CSV data string, with headers, to a data array suitable for D3
function CSV_ToArray(csv) {
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

function Charts(upDownDivID, temperatureDivID, humidityDivID, upDownTimeData, tempHumidityData) {

    var upDownDiv = d3.select(upDownDivID);
    var temperatureDiv = d3.select(temperatureDivID);
    var humidityDiv = d3.select(humidityDivID);

    const parseDT = d3.timeParse("%Y-%m-%d %H:%M"); // Use D3's parser for DT values

    colorMap = new Map([
        [0, { label: "PWR on", color: "steelblue" }],
        [1, { label: "PWR was off", color: "red" }],
    ]);

    // CVT data from CSV to array
    upDownDataArray = CSV_ToArray(upDownTimeData);
    tempHumidityDataArray = CSV_ToArray(tempHumidityData);

    // CVT Strings in upDownDataArray to other datatypes
    // Calc min and max for Y axis
    upDownDataArray.forEach(function (value, index, array) {
        array[index].DT = parseDT(value.DT);
        array[index].WasOff = Number(value.WasOff);
    })

    // CVT Strings in tempHumidityDataArray to other datatypes
    // Calc min and max for Y axis
    var yMinTemperature = 999, yMaxTemperature = -1;
    var yMinHumidity = 999, yMaxHumidity = -1;
    tempHumidityDataArray.forEach(function (value, index, array) {
        array[index].DT = parseDT(value.DT);
        var val = array[index].Temperature = Number(value.Temperature);
        yMinTemperature = Math.min(yMinTemperature, val);
        yMaxTemperature = Math.max(yMaxTemperature, val);
        val = array[index].Humidity = Number(value.Humidity);
        yMinHumidity = Math.min(yMinHumidity, val);
        yMaxHumidity = Math.max(yMaxHumidity, val);
        array[index].WasOff = Number(value.WasOff);
    })

    // Set the dimensions and margins for the charts
    var chartMargin = { top: 10, right: 3, bottom: 20, left: 30 },
        chartWidth = 800 - chartMargin.left - chartMargin.right,
        upDownHeight = 100 - chartMargin.top - chartMargin.bottom,
        tempHumidityHeight = 250 - chartMargin.top - chartMargin.bottom;

    // Append the svg objects within the specified div
    // along with the primary g elements.
    var svg = upDownDiv // https://d3js.org/d3-selection/selecting
        .append("svg")
        .attr("width", chartWidth + chartMargin.left + chartMargin.right)
        .attr("height", upDownHeight + chartMargin.top + chartMargin.bottom);
    var upDownG = svg.append("g")
        .attr("id", "UpDownG")
        .attr("transform",
            "translate(" + chartMargin.left + "," + chartMargin.top + ")");

    svg = temperatureDiv // https://d3js.org/d3-selection/selecting
        .append("svg")
        .attr("width", chartWidth + chartMargin.left + chartMargin.right)
        .attr("height", tempHumidityHeight + chartMargin.top + chartMargin.bottom);
    var temperatureG = svg.append("g")
        .attr("id", "TemperatureG")
        .attr("transform",
            "translate(" + chartMargin.left + "," + chartMargin.top + ")");

    svg = humidityDiv // https://d3js.org/d3-selection/selecting
        .append("svg")
        .attr("width", chartWidth + chartMargin.left + chartMargin.right)
        .attr("height", tempHumidityHeight + chartMargin.top + chartMargin.bottom);
    var humidityG = svg.append("g")
        .attr("id", "HumidityG")
        .attr("transform",
            "translate(" + chartMargin.left + "," + chartMargin.top + ")");

    // <div> and <p> for the tooltips. Does not matter what <div> is used...
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
    // Prepare X axis --> some attributes shared among all charts
    //
    const xScale = d3.scaleTime();                  // A D3 scaler
    const extent = d3.extent(tempHumidityDataArray, // Let D3 calculate extent
        function (d) { return d.DT; });
    // Stretch the extent a bit, helps with X margin apperance
    // FYI: the extent array has references to data elements rather
    // than copies. MAke a new Date so as to not mess with the original data.
    extent[0] = new Date(extent[0]);
    extent[0].setHours(extent[0].getHours() - 3); // Stretch out a bit, helps
    extent[1] = new Date(extent[1]);
    extent[1].setHours(extent[1].getHours() + 3); // with chart X margin
    xScale.domain(extent)
        .range([0, chartWidth]);
    const xAxis = d3.axisBottom(xScale)
        .ticks(7);

    // Line generator, supplies coords from data for the line segments
    var d3Line = d3.line()
        .x(function (d) { return xScale(d.x) })
        .y(function (d) { return yScale(d.y) });

    // ***** UpDownTimeChart

    // X axis (each chart shares similar X axis)
    upDownG.append("g")
        .style("font-size", "12px")
        .attr("transform", `translate(0, ${upDownHeight})`)
        .call(xAxis);

    // Y axis
    var yScale = d3.scaleLinear()
        .domain([2, -1]) // Values in data are 0,1, add a bit of margin
        .range([upDownHeight, 0]);
    var uDT_YAxis = d3.axisLeft(yScale).ticks(0);
    upDownG.append("g")
        .style("font-size", "14px")
        .call(uDT_YAxis);

    // Look as though there is no straight-forward means to gen <path>s
    // with different color segments. So this'll generate path in segments
    // of runs of the same color.
    var lastCategory = upDownDataArray[1].WasOff; // No need for transition between 0 and 1
    var pathArray = [{ "x": upDownDataArray[0].DT, "y": upDownDataArray[0].WasOff }];
    for (i = 1; i < upDownDataArray.length; i++) {

        var category = upDownDataArray[i].WasOff;

        if (category != lastCategory) {
            // Render path up to this point
            upDownG.append("path")
                .datum(pathArray)
                .attr("fill", "none")
                .attr("stroke", colorMap.get(lastCategory).color)
                .attr("stroke-width", 1.5)
                .attr("d", d3Line)

            pathArray = [];
            lastCategory = category;
            // Starting point for next segment
            pathArray.push({ "x": upDownDataArray[i - 1].DT, "y": upDownDataArray[i - 1].WasOff });
        }
        pathArray.push({ "x": upDownDataArray[i].DT, "y": upDownDataArray[i].WasOff });
    }

    // Add the last segment, if there is one.
    if (pathArray.length > 0)
        upDownG.append("path")
            .datum(pathArray)
            .attr("fill", "none")
            .attr("stroke", colorMap.get(lastCategory).color)
            .attr("stroke-width", 1.5)
            .attr("d", d3Line)

    // Circles at the data points
    var symbolsG = upDownG.append("g");
    for (var i = 0; i < upDownDataArray.length; i++) {
        var d = upDownDataArray[i];
        var category = d.WasOff;
        var circle = symbolsG.append('circle')
            .attr("id", i.toString()) // For finding temperatureData element in events
            .attr("cx", xScale(d.DT))
            .attr("cy", yScale(d.WasOff))
            .attr("r", 3)
            .attr("stroke", "black")
            .attr("fill", colorMap.get(category).color)
            .attr("data-whichchart", "u");
        // Tooltip for circle
        circle.attr("onmouseover", "OnMouseOver(this, event)")
            .attr("onmousemove", "OnMouseMove(this)")
            .attr("onmouseleave", "OnMouseOut(this)");
    }

    // *****  Temperature chart

    // X axis (each chart shares similar X axis)
    temperatureG.append("g")
        .style("font-size", "12px")
        .attr("transform", `translate(0, ${tempHumidityHeight})`)
        .call(xAxis);

    // Y axis
    var yScale = d3.scaleLinear()
        .domain([yMinTemperature - 2, yMaxTemperature + 2]) // +-2, bit of extra space
        .range([tempHumidityHeight, 0]);
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
    lastCategory = tempHumidityDataArray[1].WasOff; // No need for transition between 0 and 1
    pathArray = [{ "x": tempHumidityDataArray[0].DT, "y": tempHumidityDataArray[0].Temperature }];
    for (i = 1; i < tempHumidityDataArray.length; i++) {

        var category = tempHumidityDataArray[i].WasOff;

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
            pathArray.push({ "x": tempHumidityDataArray[i - 1].DT, "y": tempHumidityDataArray[i - 1].Temperature });
        }
        pathArray.push({ "x": tempHumidityDataArray[i].DT, "y": tempHumidityDataArray[i].Temperature });
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
    symbolsG = temperatureG.append("g");
    for (var i = 0; i < tempHumidityDataArray.length; i++) {
        var d = tempHumidityDataArray[i];
        var category = d.WasOff;
        var circle = symbolsG.append('circle')
            .attr("id", i.toString()) // For finding temperatureData element in events
            .attr("cx", xScale(d.DT))
            .attr("cy", yScale(d.Temperature))
            .attr("r", 3)
            .attr("stroke", "black")
            .attr("fill", colorMap.get(category).color)
            .attr("data-whichchart", "t");
        // Tooltip for circle
        circle.attr("onmouseover", "OnMouseOver(this, event)")
            .attr("onmousemove", "OnMouseMove(this)")
            .attr("onmouseleave", "OnMouseOut(this)");
    }

    // ***** Humidity chart

    // X axis (duplicate of temperature chart X axis)
    humidityG.append("g")
        .style("font-size", "12px")
        .attr("transform", `translate(0, ${tempHumidityHeight})`)
        .call(xAxis);

    // Y axis
    yScale = d3.scaleLinear()
        .domain([yMinHumidity - 2, yMaxHumidity + 2]) // +-2, bit of extra space
        .range([tempHumidityHeight, 0]);
    humidityG.append("g")
        .style("font-size", "14px")
        .call(d3.axisLeft(yScale));

    // Look as though there is no straight-forward means to gen <path>s
    // with different color segments. So this'll generate path in segments
    // of runs of the same color.
    lastCategory = tempHumidityDataArray[1].WasOff; // No need for transition between 0 and 1
    pathArray = [{ "x": tempHumidityDataArray[0].DT, "y": tempHumidityDataArray[0].Humidity }];
    for (i = 1; i < tempHumidityDataArray.length; i++) {

        var category = tempHumidityDataArray[i].WasOff;

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
            pathArray.push({ "x": tempHumidityDataArray[i - 1].DT, "y": tempHumidityDataArray[i - 1].Humidity });
        }
        pathArray.push({ "x": tempHumidityDataArray[i].DT, "y": tempHumidityDataArray[i].Humidity });
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
    for (var i = 0; i < tempHumidityDataArray.length; i++) {
        var d = tempHumidityDataArray[i];
        var category = d.WasOff;
        var circle = symbolsG.append('circle')
            .attr("id", i.toString()) // For finding temperatureData element in events
            .attr("cx", xScale(d.DT))
            .attr("cy", yScale(d.Humidity))
            .attr("r", 3)
            .attr("stroke", "black")
            .attr("fill", colorMap.get(category).color)
            .attr("data-whichchart", "h");
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
    var element;
    switch (circle.getAttribute("data-whichchart")) {
        case "u":
            element = upDownDataArray[i];
            break;
        case "t":
        case "h":
            element = tempHumidityDataArray[i];
            break;
        default:
    }
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
    switch (circle.getAttribute("data-whichchart")) {
        case "u":
            aStr = "";
            break;
        case "t":
            aStr = element.Temperature.toString() + "F ";
            break;
        case "h":
            aStr = element.Humidity.toString() + "% ";
            break;
        default:
    }
    aStr += aDT_Str + powerOffStr;
    tooltipPara.html(aStr);
}
function OnMouseMove(circle) {
} // tooltip.style("top", (offsetY - 30) + "px").style("left", (event.offsetX + 10) + "px")

function OnMouseOut(circle) {
    tooltip.style("visibility", "hidden");
}
