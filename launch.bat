@echo off

rem use this to test locally (chrome will spew x-origin errors otherwise)

echo Launching...
if exist %appdata%\..\Local\Google\Chrome\Application\chrome.exe (
	start "" %appdata%\..\Local\Google\Chrome\Application\chrome.exe --args --disable-web-security --user-data-dir="C:/chrome-temp" "http://localhost:8001"
) else (
	start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --args --disable-web-security --user-data-dir="C:/chrome-temp" "http://localhost:8001"
)
php -S localhost:8001