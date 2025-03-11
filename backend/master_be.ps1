# master_be.ps1

$sharedFolder = "$HOME/Documents/ServerData/ServerData2/data"
$historyFile = Join-Path -Path $sharedFolder -ChildPath "history.json"

# Ensure shared folder exists
if (!(Test-Path -Path $sharedFolder)) {
    New-Item -ItemType Directory -Path $sharedFolder | Out-Null
}

# Ensure history.json exists (as an empty array if not)
if (!(Test-Path -Path $historyFile)) {
    @() | ConvertTo-Json -Depth 2 | Set-Content -Path $historyFile -Encoding UTF8
}

# Load employee names mapping from JSON
$mappingFile = Join-Path -Path $sharedFolder -ChildPath "employeeNames.json"
if (!(Test-Path -Path $mappingFile)) {
    $defaultMapping = @{
        "000379070" = "Peter-Nicholas Sarateanu"
        "000123123" = "Jane Smith"
        "000987654" = "Alice Johnson"
        "000456123" = "Kylian Mbappe"
        "000789123" = "Joe Burrow"
    }
    $defaultMapping | ConvertTo-Json -Depth 3 | Set-Content -Path $mappingFile -Encoding UTF8
}
$employeeNames = Get-Content -Path $mappingFile -Raw | ConvertFrom-Json

# Helper: Log a history entry by appending an object with an action string and timestamp to history.json.
function logHistory($action, $message, $employeeName) {
    $historyFile = Join-Path -Path $sharedFolder -ChildPath "history.json"

    # If history.json does not exist or is empty or "null", initialize it to an empty array.
    if (!(Test-Path $historyFile) -or ([string]::IsNullOrWhiteSpace((Get-Content $historyFile -Raw))) -or ((Get-Content $historyFile -Raw).Trim() -eq "null")) {
        "[]" | Set-Content -Path $historyFile -Encoding UTF8
    }
    
    # Read and parse the history file.
    $rawContent = (Get-Content -Path $historyFile -Raw).Trim()
    if (-not $rawContent -or $rawContent -eq "null") {
        $existingHistory = @()
    }
    else {
        try {
            $existingHistory = $rawContent | ConvertFrom-Json
        }
        catch {
            $existingHistory = @()
        }
    }
    if (-not ($existingHistory -is [System.Collections.IEnumerable])) {
        $existingHistory = @($existingHistory)
    }
    
    # If any of the required parameters is null or empty, skip logging.
    if ([string]::IsNullOrWhiteSpace($action) -or [string]::IsNullOrWhiteSpace($message) -or [string]::IsNullOrWhiteSpace($employeeName)) {
        return
    }
    
    # Create a new log entry.
    $newLogEntry = [PSCustomObject]@{
        action    = $action
        message   = $message
        employee  = $employeeName
        timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    }
    
    # Append the new log entry and write the array back.
    $existingHistory += $newLogEntry
    $existingHistory | ConvertTo-Json -Depth 3 | Set-Content -Path $historyFile -Encoding UTF8
}

# Helper: Format a time string from "HH:mm:ss" to a history-friendly format ("HHhmm")
function Format-TimeForHistory($timeString) {
    if ($timeString -and $timeString.Length -ge 5) {
        $t = $timeString.Substring(0,5)  # Get HH:mm
        return $t -replace ":", "h"
    }
    return $timeString
}

# Function to handle errors
function respondWithError($response, $statusCode, $message) {
    $response.StatusCode = $statusCode
    $errorMsg = "{ `"error`": `"$message`" }"
    $response.OutputStream.Write([System.Text.Encoding]::UTF8.GetBytes($errorMsg), 0, [System.Text.Encoding]::UTF8.GetBytes($errorMsg).Length)
    $response.Close()
}

# Function to send success responses
function respondWithSuccess($response, $message) {
    $response.ContentType = "application/json"
    $response.StatusCode = 200
    $response.OutputStream.Write([System.Text.Encoding]::UTF8.GetBytes($message), 0, [System.Text.Encoding]::UTF8.GetBytes($message).Length)
    $response.Close()
}

# Initialize HTTP listener
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8081/")
$listener.Start()
Write-Host "Manager Server running on http://localhost:8081"

while ($true) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    try {
        $response.Headers.Add("Access-Control-Allow-Origin", "*")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.Headers.Add("Access-Control-Allow-Methods", "GET, OPTIONS, PUT, DELETE, POST")
            $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
            respondWithSuccess $response '{}'
            continue
        }

        # GET /history Endpoint
        if ($request.HttpMethod -eq "GET" -and $request.Url.AbsolutePath -eq "/history") {
            try {
                # Ensure history file exists.
                if (!(Test-Path -Path $historyFile)) {
                    "[]" | Set-Content -Path $historyFile -Encoding UTF8
                }
                $historyContent = Get-Content -Path $historyFile -Raw
                respondWithSuccess $response $historyContent
            } catch {
                respondWithError $response 500 "Error reading history: $($_.Exception.Message)"
            }
            continue
        }

        # GET /employees: Return employee list
        if ($request.HttpMethod -eq "GET" -and $request.Url.AbsolutePath -eq "/employees") {
            $employees = Get-ChildItem -Path $sharedFolder -Filter "*_data.json" | ForEach-Object {
                $code = $_.BaseName -replace "_data", ""
                @{
                    code = $code
                    name = $employeeNames.$code ?? $code
                }
            }
            respondWithSuccess $response ($employees | ConvertTo-Json -Depth 3)
            continue
        }

        # GET /employee/{employeeCode}: Return overtime data
        if ($request.HttpMethod -eq "GET" -and $request.Url.AbsolutePath -match "^/employee/(\d+)$") {
            $employeeCode = $matches[1]
            $dataFile = Join-Path -Path $sharedFolder -ChildPath "${employeeCode}_data.json"

            if (!(Test-Path -Path $dataFile)) {
                respondWithError $response 404 "Employee not found"
                continue
            }

            $mutex = New-Object System.Threading.Mutex($false, "OvertimeDataLock")
            $mutex.WaitOne()
            try {
                $jsonData = Get-Content -Path $dataFile -Raw
                respondWithSuccess $response $jsonData
            } finally {
                $mutex.ReleaseMutex()
            }
            continue
        }


        # NEW: POST /employee/add/{employeeCode}: Add an entry for an employee.
        if ($request.HttpMethod -eq "POST" -and $request.Url.AbsolutePath -match "^/employee/add/(\d+)$") {
            $employeeCode = $matches[1]
            $dataFile = Join-Path -Path $sharedFolder -ChildPath "${employeeCode}_data.json"

            # If the employee data file doesn't exist, initialize it as an empty array.
            if (!(Test-Path -Path $dataFile)) {
                @() | ConvertTo-Json -Depth 2 | Set-Content -Path $dataFile -Encoding UTF8
            }

            $reader = New-Object IO.StreamReader($request.InputStream)
            $payload = $reader.ReadToEnd() | ConvertFrom-Json
            $reader.Close()

            # Require payload to include date, punchIn, and punchOut.
            if (-not ($payload.date -and $payload.punchIn -and $payload.punchOut)) {
                respondWithError $response 400 "Missing required fields: date, punchIn, and punchOut are required."
                continue
            }

            # Round times to the minute (set seconds to "00").
            $punchInRounded = (($payload.punchIn -split ":")[0] + ":" + ($payload.punchIn -split ":")[1] + ":00")
            $punchOutRounded = (($payload.punchOut -split ":")[0] + ":" + ($payload.punchOut -split ":")[1] + ":00")

            # Validate that punchOut is after punchIn.
            $punchInTime = [DateTime]::ParseExact("$($payload.date) $punchInRounded", "yyyy-MM-dd HH:mm:ss", $null)
            $punchOutTime = [DateTime]::ParseExact("$($payload.date) $punchOutRounded", "yyyy-MM-dd HH:mm:ss", $null)
            if ($punchOutTime -le $punchInTime) {
                respondWithError $response 400 "Punch Out must be after Punch In."
                continue
            }

            # Read the existing data.
            $existingData = Get-Content -Path $dataFile -Raw | ConvertFrom-Json
            if (-not ($existingData -is [System.Collections.IEnumerable])) {
                $existingData = @($existingData)
            }

            # Create the new entry.
            $newEntry = @{
                name     = $employeeNames.$employeeCode ?? $employeeCode
                date     = $payload.date
                punchIn  = $punchInRounded
                punchOut = $punchOutRounded
                overtime = ($punchOutTime - $punchInTime).ToString("hh\:mm\:ss")
                status   = "pending"
            }
            $existingData += $newEntry
            $existingData | ConvertTo-Json -Depth 3 | Set-Content -Path $dataFile -Encoding UTF8

            # Log history for adding.
            $employeeName = $employeeNames.$employeeCode ?? $employeeCode
            $formattedDate = (Get-Date $payload.date).ToString("MMMM dd, yyyy")
            $historyMessage = "Added an entry on $formattedDate, starting at <strong>$(Format-TimeForHistory $punchInRounded)</strong> and finishing at <strong>$(Format-TimeForHistory $punchOutRounded)</strong>."
            logHistory "Add" $historyMessage $employeeName

            $responseMessage = @{
                message = "Entry added successfully."
                time = $punchInRounded
            }
            $responseString = $responseMessage | ConvertTo-Json -Depth 3
            $response.ContentType = "application/json"
            $response.StatusCode = 200
            $response.OutputStream.Write([System.Text.Encoding]::UTF8.GetBytes($responseString), 0, [System.Text.Encoding]::UTF8.GetBytes($responseString).Length)
            $response.Close()
            continue
        }

        # PUT /employee/{employeeCode}: Update overtime entry.
        if ($request.HttpMethod -eq "PUT" -and $request.Url.AbsolutePath -match "^/employee/(\d+)$") {
            $employeeCode = $matches[1]
            $dataFile = Join-Path -Path $sharedFolder -ChildPath "${employeeCode}_data.json"

            if (!(Test-Path -Path $dataFile)) {
                respondWithError $response 404 "Employee not found"
                continue
            }

            $reader = New-Object IO.StreamReader($request.InputStream)
            $payload = $reader.ReadToEnd() | ConvertFrom-Json
            $reader.Close()

            # Require payload to include the date and the original punchIn (stable identifier).
            if (-not ($payload.date -and $payload.originalPunchIn)) {
                respondWithError $response 400 "Missing required identifier: date and originalPunchIn are required."
                continue
            }

            # Determine new punchIn value.
            $newPunchIn = $payload.newPunchIn
            if (-not $newPunchIn) { $newPunchIn = $payload.originalPunchIn }

            # Optionally update punchOut if provided.
            $newPunchOut = $payload.punchOut

            # Round times to the minute (set seconds to "00").
            $newPunchIn = (($newPunchIn -split ":")[0] + ":" + ($newPunchIn -split ":")[1] + ":00")
            if ($newPunchOut) {
                $newPunchOut = (($newPunchOut -split ":")[0] + ":" + ($newPunchOut -split ":")[1] + ":00")
            }

            $mutex = New-Object System.Threading.Mutex($false, "OvertimeDataLock")
            $mutex.WaitOne()
            try {
                $existingData = Get-Content -Path $dataFile -Raw | ConvertFrom-Json
                if (-not ($existingData -is [System.Collections.IEnumerable])) {
                    $existingData = @($existingData)
                }

                # Find the entry index by matching date and original punchIn.
                $foundIndex = -1
                for ($i = 0; $i -lt $existingData.Count; $i++) {
                    if ($existingData[$i].date -eq $payload.date -and $existingData[$i].punchIn -eq $payload.originalPunchIn) {
                        $foundIndex = $i
                        break
                    }
                }
                if ($foundIndex -eq -1) {
                    respondWithError $response 404 "Entry not found"
                    continue
                }

                # Initialize an array for individual update messages.
                $messages = @()

                # Update punchIn if changed.
                if ($payload.originalPunchIn -ne $newPunchIn) {
                    $existingData[$foundIndex].punchIn = $newPunchIn
                    $messages += "Punch In from <strong>$(Format-TimeForHistory $payload.originalPunchIn)</strong> to <strong>$(Format-TimeForHistory $newPunchIn)</strong>."
                }

                # Update punchOut if provided.
                if ($newPunchOut) {
                    if ($existingData[$foundIndex].punchOut -and $existingData[$foundIndex].punchOut -ne $newPunchOut) {
                        $messages += "Punch Out from <strong>$(Format-TimeForHistory $existingData[$foundIndex].punchOut)</strong> to <strong>$(Format-TimeForHistory $newPunchOut)</strong>."
                    }
                    elseif (-not $existingData[$foundIndex].punchOut) {
                        $messages += "Punch Out recorded at <strong>$(Format-TimeForHistory $newPunchOut)</strong>."
                    }
                    $existingData[$foundIndex].punchOut = $newPunchOut
                }

                # Recalculate overtime if both punchIn and punchOut exist.
                if ($existingData[$foundIndex].punchIn -and $existingData[$foundIndex].punchOut) {
                    $punchInTime = [DateTime]::ParseExact("$($existingData[$foundIndex].date) $($existingData[$foundIndex].punchIn)", "yyyy-MM-dd HH:mm:ss", $null)
                    $punchOutTime = [DateTime]::ParseExact("$($existingData[$foundIndex].date) $($existingData[$foundIndex].punchOut)", "yyyy-MM-dd HH:mm:ss", $null)
                    $existingData[$foundIndex].overtime = ($punchOutTime - $punchInTime).ToString("hh\:mm\:ss")
                }

                # Save the updated data.
                $updatedJson = $existingData | ConvertTo-Json -Depth 3
                Set-Content -Path $dataFile -Value $updatedJson -Encoding UTF8

                # Build the history log message.
                $employeeName = $employeeNames.$employeeCode ?? $employeeCode
                # Format the modified entry date (e.g., "February 26, 2025").
                $formattedDate = (Get-Date $payload.date).ToString("MMMM dd, yyyy")
                if ($messages.Count -eq 0) {
                    $finalMessage = "Entry on $formattedDate updated successfully."
                }
                else {
                    $finalMessage = "Updated an entry on $formattedDate, " + ($messages -join " ")
                }
                # Log history with the action type "Update".
                logHistory "Update" $finalMessage $employeeName

                respondWithSuccess $response ('{ "message": "' + ($messages -join "<br>") + '" }')
            } catch {
                respondWithError $response 500 "Error: '$($_.Exception.Message)'"
            } finally {
                $mutex.ReleaseMutex()
            }
            continue
        }

        # POST /employee/approval/{employeeCode}: Update approval status.
        if ($request.HttpMethod -eq "POST" -and $request.Url.AbsolutePath -match "^/employee/approval/(\d+)$") {
            $employeeCode = $matches[1]
            $dataFile = Join-Path -Path $sharedFolder -ChildPath "${employeeCode}_data.json"
            
            if (!(Test-Path -Path $dataFile)) {
                respondWithError $response 404 "Error: Employee not found."
                continue
            }
            
            $reader = New-Object IO.StreamReader($request.InputStream)
            $payload = $reader.ReadToEnd() | ConvertFrom-Json
            $reader.Close()
            
            if (-not ($payload.date -and $payload.punchIn -and $payload.status)) {
                respondWithError $response 400 "Error: Missing required fields (date, punchIn, status)"
                continue
            }
            
            try {
                $existingData = Get-Content -Path $dataFile -Raw | ConvertFrom-Json
                if (-not ($existingData -is [System.Collections.IEnumerable])) {
                    $existingData = @($existingData)
                }
                $found = $false
                foreach ($entry in $existingData) {
                    if ($entry.date -eq $payload.date -and $entry.punchIn -eq $payload.punchIn) {
                        $entry.status = $payload.status
                        $found = $true
                        break
                    }
                }
                if (-not $found) {
                    respondWithError $response 404 "Error: Overtime entry not found"
                    continue
                }
                # Convert updated data to JSON and save it back to the file.
                $jsonOut = $existingData | ConvertTo-Json -Depth 3
                Set-Content -Path $dataFile -Value $jsonOut -Encoding UTF8
                
                # Log history for approval/disapproval.
                $currentDate = (Get-Date).ToString("MMMM dd")
                $formattedDate = (Get-Date $payload.date).ToString("MMMM dd, yyyy")
                $employeeName = $employeeNames.$employeeCode ?? $employeeCode
                $action = if ($payload.status -eq "approved") { "Approved" } else { "Rejected" }

                $historyEntry = "$action an entry on $formattedDate starting at <strong>$(Format-TimeForHistory $payload.punchIn)</strong>."
                logHistory $action $historyEntry $employeeName

                $response.ContentType = "application/json"
                $response.StatusCode = 200
                $response.OutputStream.Write([System.Text.Encoding]::UTF8.GetBytes($jsonOut), 0, [System.Text.Encoding]::UTF8.GetBytes($jsonOut).Length)
                $response.Close()
            } catch {
                respondWithError $response 500 "Error: '$($_.Exception.Message)'"
            }
            continue
        }

        # DELETE /employee/{employeeCode}: Delete an overtime entry.
        if ($request.HttpMethod -eq "DELETE" -and $request.Url.AbsolutePath -match "^/employee/(\d+)$") {
            $employeeCode = $matches[1]
            $dataFile = Join-Path -Path $sharedFolder -ChildPath "${employeeCode}_data.json"
            $query = [System.Web.HttpUtility]::ParseQueryString($request.Url.Query)
            $delDate = $query["date"]
            $delPunchIn = $query["punchIn"]

            if (!(Test-Path -Path $dataFile)) {
                respondWithError $response 404 "Employee not found"
                continue
            }
            if (-not ($delDate -and $delPunchIn)) {
                respondWithError $response 400 "Missing query parameters: date and punchIn are required."
                continue
            }

            $mutex = New-Object System.Threading.Mutex($false, "OvertimeDataLock")
            $mutex.WaitOne()
            try {
                $existingData = Get-Content -Path $dataFile -Raw | ConvertFrom-Json
                if (-not ($existingData -is [System.Collections.IEnumerable])) { 
                    $existingData = @($existingData) 
                }
                # Find the entry to delete for logging.
                $entryToDelete = $existingData | Where-Object { $_.date -eq $delDate -and $_.punchIn -eq $delPunchIn } | Select-Object -First 1

                $filteredData = $existingData | Where-Object { $_.date -ne $delDate -or $_.punchIn -ne $delPunchIn }
                if ($filteredData.Count -eq $existingData.Count) {
                    respondWithError $response 404 "Entry not found"
                    continue
                }
                Set-Content -Path $dataFile -Value ($filteredData | ConvertTo-Json -Depth 3) -Encoding UTF8

                # Log history for deletion.
                $currentDate = (Get-Date).ToString("MMMM dd")
                $formattedDate = (Get-Date $delDate).ToString("MMMM dd, yyyy")
                $employeeName = $employeeNames.$employeeCode ?? $employeeCode

                if ($entryToDelete) {
                    $punchInDisplay = Format-TimeForHistory $entryToDelete.punchIn
                    $punchOutDisplay = if ($entryToDelete.punchOut) { " and finishing at " + (Format-TimeForHistory $entryToDelete.punchOut) } else { "" }
                    $historyEntry = "Deleted an entry on $formattedDate starting at <strong>$(Format-TimeForHistory $entryToDelete.punchIn)</strong>."
                    logHistory "Delete" $historyEntry $employeeName
                }
                respondWithSuccess $response '{ "message": "Entry deleted successfully." }'
            } finally {
                $mutex.ReleaseMutex()
            }
            continue
        }
        respondWithError $response 400 "Invalid request"

    } catch {
        respondWithError $response 500 $_.Exception.Message
    }
}