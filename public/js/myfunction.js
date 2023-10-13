function sendData(row) {
    var cells = row.getElementsByTagName("td");
    var textbox = document.getElementById("studentInfo");
  
    // Extract data from each cell in the row
    var rowData = [];
    for (var i = 0; i < cells.length; i++) {
      rowData.push(cells[i].textContent);
    }
  
    // Set the textbox value to the extracted data
    textbox.value = rowData.join(" | ");
  }