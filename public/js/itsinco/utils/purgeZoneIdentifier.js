const fs = require('fs');
const path = require('path');

function deleteZoneIdentifierFiles(dir) {
  fs.readdir(dir, { withFileTypes: true }, (err, files) => {
    if (err) {
      console.error(`Error reading directory ${dir}:`, err);
      return;
    }

    files.forEach((file) => {
      const filePath = path.join(dir, file.name);

      if (file.isDirectory()) {
        // Recursively process subdirectories
        deleteZoneIdentifierFiles(filePath);
      } else if (file.name.includes('Zone.Identifier')) {
        // Delete the file
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error(`Error deleting file ${filePath}:`, err);
          } else {
            console.log(`Deleted: ${filePath}`);
          }
        });
      }
    });
  });
}

// Start the cleanup process from the current directory
deleteZoneIdentifierFiles(__dirname);