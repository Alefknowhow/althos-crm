const { execSync } = require('child_process');
try {
  console.log('Installing recharts...');
  execSync('npm install recharts', { stdio: 'inherit' });
  console.log('Successfully installed recharts');
} catch (error) {
  console.error('Failed to install recharts:', error.message);
}
