const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const scriptDir = path.dirname(process.argv[1]);
const projectRoot = path.join(scriptDir, '..');

function log(msg) {
  console.log(`\x1b[36m[Builder]\x1b[0m ${msg}`);
}

function error(msg) {
  console.error(`\x1b[31m[Error]\x1b[0m ${msg}`);
  process.exit(1);
}

// 1. Read version from package.json
log('Reading version from package.json...');
const packageJsonPath = path.join(projectRoot, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  error('package.json not found in the root directory.');
}

let version = '1.0.0';
try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  version = packageJson.version || '1.0.0';
} catch (e) {
  log('Warning: Failed to parse package.json. Defaulting to v1.0.0');
}
log(`Detected version: v${version}`);

// 2. Clear previous prebuild folders
log('Cleaning previous prebuild android/ios folders...');
const androidDir = path.join(projectRoot, 'android');
const iosDir = path.join(projectRoot, 'ios');

if (fs.existsSync(androidDir)) {
  log('Deleting android/ folder...');
  try {
    fs.rmSync(androidDir, { recursive: true, force: true });
  } catch (e) {
    log(`Warning: Failed to delete android/ folder via Node: ${e.message}. Trying shell clean...`);
  }
}
if (fs.existsSync(iosDir)) {
  log('Deleting ios/ folder...');
  try {
    fs.rmSync(iosDir, { recursive: true, force: true });
  } catch (e) {
    log(`Warning: Failed to delete ios/ folder: ${e.message}`);
  }
}

// 3. Run Expo Prebuild
log('Running Expo prebuild for Android...');
try {
  execSync('npx expo prebuild --platform android', {
    cwd: projectRoot,
    stdio: 'inherit',
  });
} catch (err) {
  error('Expo prebuild failed.');
}

// 4. Run Gradle Release Build
log('Building release APK using Gradle...');
const gradleCmd = os.platform() === 'win32' ? 'gradlew.bat' : './gradlew';
const gradlePath = path.join(androidDir, gradleCmd);

if (!fs.existsSync(gradlePath)) {
  error(`Gradle wrapper not found at: ${gradlePath}`);
}

try {
  execSync(`${gradleCmd} assembleRelease`, {
    cwd: androidDir,
    stdio: 'inherit',
  });
} catch (err) {
  error('Gradle build failed.');
}

// 5. Locate built APK
log('Locating built APK...');
const apkOutputDir = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release');
if (!fs.existsSync(apkOutputDir)) {
  error(`APK output directory not found at: ${apkOutputDir}`);
}

const files = fs.readdirSync(apkOutputDir);
const apkFile = files.find(f => f.endsWith('.apk'));

if (!apkFile) {
  error(`No APK file found in ${apkOutputDir}`);
}

const sourceApkPath = path.join(apkOutputDir, apkFile);
const apksDestDir = path.join(projectRoot, 'apks');

// Ensure destination directory exists
if (!fs.existsSync(apksDestDir)) {
  log('Creating apks/ directory...');
  fs.mkdirSync(apksDestDir, { recursive: true });
}

const destApkName = `centread-v${version}.apk`;
const destApkPath = path.join(apksDestDir, destApkName);

log(`Moving built APK from ${sourceApkPath} to ${destApkPath}...`);
try {
  fs.copyFileSync(sourceApkPath, destApkPath);
  log(`\x1b[32mSuccess!\x1b[0m APK created at: ${destApkPath}`);
} catch (copyErr) {
  error(`Failed to copy APK to destination: ${copyErr.message}`);
}
