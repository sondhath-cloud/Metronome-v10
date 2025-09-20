# 404 Error Troubleshooting Guide

## Quick Checklist

### ✅ **1. File Structure**
Make sure your server has this exact structure:
```
your-domain.com/
├── index.html          ← Main file (MUST be in root)
├── style.css
├── script.js
├── audio-manager.js
├── microphone-input.js
├── audio/
│   └── audio/
│       ├── countin-accent.mp3
│       └── countin-beat.mp3
└── README.md
```

### ✅ **2. Common Issues**

**Problem**: Files uploaded to wrong directory
- **Solution**: Move all files to the web server's root directory (usually `public_html/` or `www/`)

**Problem**: Missing index.html in root
- **Solution**: Ensure `index.html` is in the main directory, not in a subfolder

**Problem**: Wrong file permissions
- **Solution**: Set files to 644 and directories to 755

**Problem**: Server doesn't recognize .html files
- **Solution**: Check server configuration or try `index.htm` instead

### ✅ **3. Testing Steps**

1. **Test locally first**:
   ```bash
   cd dist/
   python3 -m http.server 8000
   # Visit http://localhost:8000
   ```

2. **Check file paths**:
   - Visit: `your-domain.com/index.html`
   - If that works, the issue is with default file handling

3. **Verify all files uploaded**:
   - Check that all 8 files are present
   - Ensure audio folder structure is correct

### ✅ **4. Server-Specific Solutions**

**Apache Servers**:
- Ensure `.htaccess` allows .html files
- Check if mod_rewrite is enabled

**Nginx Servers**:
- Verify index directive includes index.html
- Check file permissions

**cPanel/Shared Hosting**:
- Upload to `public_html/` directory
- Check file manager shows all files

**GitHub Pages**:
- Upload to root of repository
- Enable Pages in repository settings

### ✅ **5. Debug Commands**

Check if files are accessible:
```bash
# Test each file individually
curl -I https://your-domain.com/index.html
curl -I https://your-domain.com/style.css
curl -I https://your-domain.com/script.js
```

### ✅ **6. Alternative Solutions**

If still getting 404:

1. **Rename index.html to index.htm**
2. **Create a .htaccess file** with:
   ```
   DirectoryIndex index.html index.htm
   ```
3. **Check server error logs** for specific error messages
4. **Contact your hosting provider** for server configuration help

### ✅ **7. Quick Fix Script**

If you have SSH access, run this to fix permissions:
```bash
chmod 644 *.html *.css *.js
chmod 755 audio/
chmod 644 audio/audio/*.mp3
```

## Still Having Issues?

1. **Check browser console** for JavaScript errors
2. **Verify server supports** modern JavaScript features
3. **Test with different browsers** (Chrome, Firefox, Safari)
4. **Check if server blocks** certain file types

## Contact Information

If you need further assistance, please provide:
- Your server type (Apache, Nginx, etc.)
- Error messages from browser console
- Server error logs
- Exact URL you're trying to access
