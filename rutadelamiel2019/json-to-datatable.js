#!/usr/bin/env node

/**
 * Usage:
 * node json_to_bootstrap_datatable.js <URL_TO_JSON_OBJECT> [outputFile.html]
 *
 * This script forces the mobile card view for all screens and applies custom column titles.
 */

const fs = require('fs');
const fetch = require('node-fetch');

// --- Configuration ---
const url = process.argv[2];
const outputFile = process.argv[3] || 'data_table_card_view.html';
const DATA_ARRAY_KEY = 'data'; 

// LIST OF COLUMNS YOU WANT TO HIDE COMPLETELY
const EXCLUDED_COLUMNS = [
    'promedio',
    'penalizacion',
    'motivopenalizacion'
];
// ---------------------

if (!url) {
  console.error('Error: Please provide the URL to the JSON data as the first argument.');
  console.error('Usage: node json_to_bootstrap_datatable.js <URL_TO_JSON_OBJECT> [outputFile.html]');
  process.exit(1);
}

/**
 * Generates the full HTML template.
 */
const htmlTemplate = (headerHtml, columnsJsString, jsonString) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Resultados visualizados por HilandoPixel</title>
    
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">

    <link rel="stylesheet" type="text/css" href="https://cdn.datatables.net/2.0.8/css/dataTables.bootstrap5.min.css">
    
    <link rel="stylesheet" type="text/css" href="https://cdn.datatables.net/responsive/3.0.2/css/responsive.bootstrap5.min.css">
    
    <style>
        body { background-color: #f8f9fa; }
        .container { 
            margin-top: 50px; 
            margin-bottom: 50px;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }
        h1 { color: #007bff; margin-bottom: 20px; }
        
        /* Force Header Hiding for the Card View Aesthetic on ALL screens */
        #dataTable thead {
            display: none;
        }

        /* Adjust the search and control section to be slightly wider */
        .dataTables_wrapper .row:first-child {
            margin-bottom: 20px;
        }

    </style>
</head>
<body>
    <div class="container">
        <h1 class="mb-4">Resultados visualizados por HilandoPixel</h1>
        <a class="text-muted mb-4" href="${url}" target="_blank">Fuente de resultados: <code>${url}</code></a>
        
        <table id="dataTable" class="table table-striped table-hover border w-100">
            <thead class="table-primary">
                <tr>
                    ${headerHtml}
                </tr>
            </thead>
            <tbody>
                </tbody>
        </table>
    </div>

    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" crossorigin="anonymous"></script>

    <script src="https://cdn.datatables.net/2.0.8/js/dataTables.min.js"></script>
    <script src="https://cdn.datatables.net/2.0.8/js/dataTables.bootstrap5.min.js"></script>
    <script src="https://cdn.datatables.net/responsive/3.0.2/js/dataTables.responsive.min.js"></script>
    <script src="https://cdn.datatables.net/responsive/3.0.2/js/responsive.bootstrap5.min.js"></script>

    <script>
        // 1. CUSTOM JAVASCRIPT FUNCTION
        function getPhotos(tiempo) {
            if (tiempo === 'null') {
                alert('Tiempo no disponible para buscar fotos.');
            } else {
                alert('Buscando fotos para el tiempo: ' + tiempo);
                console.log('Action: Fetch photos for time:', tiempo);
            }
        }
    
        // 2. Load the JSON data into a JavaScript variable
        const jsonData = ${jsonString}; 

        // 3. Initialize DataTables
        $(document).ready(function() {
            const columns = ${columnsJsString}; 
            
            if (columns.length > 0) {
                $('#dataTable').DataTable({
                    data: jsonData,
                    columns: columns,
                    
                    // ENABLE RESPONSIVE MODE
                    responsive: true, 
                    
                    // Configuration for non-paginated table
                    paging: false,   
                    info: false,     
                    
                    // Set language to Spanish
                    language: {
                        search: "Buscar:",
                        emptyTable: "No hay datos disponibles en la tabla.",
                        zeroRecords: "No se encontraron coincidencias.",
                        infoEmpty: "Mostrando 0 a 0 de 0 entradas"
                    }
                });
            } else {
                $('#dataTable').html('<thead><tr><th>Sin Datos</th></tr></thead><tbody><tr><td>No se encontraron registros o el array JSON está vacío.</td></tr></tbody>');
            }
        });
    </script>
</body>
</html>
`;


async function run() {
    console.log(`Fetching data from: ${url}`);
    
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const rootObject = await response.json();

        const dataArray = rootObject[DATA_ARRAY_KEY];
        
        if (!Array.isArray(dataArray)) {
            console.error(`\n❌ Error: Failed to find the data array under the expected key "${DATA_ARRAY_KEY}".`);
            process.exit(1);
        }
        
        if (dataArray.length === 0) {
            console.warn('Warning: The fetched JSON array is empty. The output table will have no rows.');
        }

        const keys = dataArray.length > 0 ? Object.keys(dataArray[0]) : [];
        let headerHtml = '';
        let columnsJsString = '[';
        
        // --- Column Generation Logic (Exclusion, Priority, and Custom Renderer) ---
        for (const key of keys) {
            
            if (EXCLUDED_COLUMNS.includes(key)) {
                continue; // Skip this column
            }
            
            let title = key.charAt(0).toUpperCase() + key.slice(1);
            let priority = 100; // Default high priority forces collapse for the card view

            // RENAME
            if (key === 'posicionprueba') {
                title = 'Posicion Categoria'; // Renamed from Posicionprueba to PosCat
            }

            // SET VISIBILITY PRIORITY (Updated to force collapse for non-essential info)
            if (key === 'nombre') {
                priority = 1; // Highest priority: Name should always be visible in the main row
            } else if (key === 'tiempo') {
                priority = 2; // High priority: Time should be visible in the main row if possible
            } else if (key === 'linkdiploma') {
                priority = 3; // Keep button visible if space allows
            } else {
                // Everything else (PosCat, club, prueba, etc.) will be forced into the collapsed details section
                priority = 100; 
            }
            
            if (key === 'linkdiploma') {
                // Special handling for the 'Fotos' button column
                headerHtml += '<th>Fotos</th>';
                
                const renderFunction = `function(data, type, row) {
                    const tiempoValue = row.tiempo ? "'" + row.tiempo.replace(/'/g, "\\'") + "'" : 'null';
                    return '<button type="button" class="btn btn-sm btn-info" onclick="getPhotos(' + tiempoValue + ')">Fotos</button>';
                }`;

                columnsJsString += `{
                    data: '${key}',
                    title: 'Fotos',
                    render: ${renderFunction},
                    searchable: false,
                    orderable: false,
                    responsivePriority: ${priority}
                },`;
            } else {
                // Default handling for all other columns
                headerHtml += `<th>${title}</th>`;
                columnsJsString += `{
                    data: '${key}',
                    title: '${title}',
                    responsivePriority: ${priority}
                },`;
            }
        }
        columnsJsString = columnsJsString.slice(0, -1) + `]`; // Remove trailing comma and close array
        // ------------------------------------

        // Convert data array back to a JSON string for embedding
        const jsonString = JSON.stringify(dataArray, null, 2);
            
        // Generate final HTML
        const finalHtml = htmlTemplate(headerHtml, columnsJsString, jsonString);
        
        fs.writeFileSync(outputFile, finalHtml, 'utf8');
        
        console.log(`\n✅ Successfully generated card-view table with custom column names.`);
        console.log(`The table now uses the mobile card view for ALL screens, and 'posicionprueba' is renamed to 'PosCat'.`);
        console.log(`📄 Output saved to: ${outputFile}`);

    } catch (error) {
        console.error(`\n❌ Failed to fetch or process data: ${error.message}`);
        process.exit(1);
    }
}

run();