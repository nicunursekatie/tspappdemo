# SMS Provider Configuration

This system supports multiple SMS providers for sending text messages. You can switch between providers using environment variables.

## Supported Providers

### 1. Twilio (Default)
Professional SMS service with carrier approval requirements.

**Environment Variables:**
```bash
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

### 2. Phone Gateway
Send SMS through your personal Android device using SMS gateway apps.

**Environment Variables:**
```bash
SMS_PROVIDER=phone_gateway
PHONE_GATEWAY_URL=http://192.168.1.100:8080/send
PHONE_GATEWAY_API_KEY=optional_api_key
PHONE_GATEWAY_DEVICE_NUMBER=+1234567890
PHONE_GATEWAY_TIMEOUT=30000
```

## Phone Gateway Setup

### Compatible Apps:
- **SMS Sender** - Popular Android SMS gateway app
- **SMSMobileAPI** - Enterprise SMS gateway solution
- **HTTP SMS Gateway** - Simple HTTP to SMS bridge

### Setup Steps:

1. **Install SMS Gateway App** on your Android device
2. **Enable HTTP Server** in the app settings
3. **Configure Network Access** - ensure the phone and server are on the same network or use port forwarding
4. **Set Environment Variables** with your phone's IP address and port
5. **Test Connection** using the admin SMS testing interface

### Example Gateway URLs:
```bash
# Local network (most common)
PHONE_GATEWAY_URL=http://192.168.1.100:8080/send

# Port forwarding setup
PHONE_GATEWAY_URL=http://your-external-ip:8080/send

# VPN or cloud tunnel
PHONE_GATEWAY_URL=https://your-tunnel-url.ngrok.io/send
```

### Request Format
The system sends POST requests with this JSON payload:
```json
{
  "phone": "+1234567890",
  "message": "Your SMS message text",
  "to": "+1234567890",
  "text": "Your SMS message text",
  "body": "Your SMS message text",
  "number": "+1234567890",
  "timestamp": "2025-09-26T04:00:00.000Z",
  "source": "sandwich_project"
}
```

### Response Format
Expected response from gateway:
```json
{
  "success": true,
  "id": "message_id_123"
}
```

Or error response:
```json
{
  "success": false,
  "error": "Error message"
}
```

## Benefits of Phone Gateway

✅ **No Approval Delays** - Works immediately with personal phone number  
✅ **Uses Existing Plan** - No additional SMS costs  
✅ **Full Control** - No carrier restrictions or content filtering  
✅ **Local Setup** - Works on your network without external dependencies  

## Switching Providers

To switch between providers, simply change the `SMS_PROVIDER` environment variable and restart the application:

```bash
# Switch to phone gateway
SMS_PROVIDER=phone_gateway

# Switch back to Twilio
SMS_PROVIDER=twilio
```

The system will automatically detect the configuration and use the appropriate provider.

## Testing

Use the admin interface SMS testing features to verify your configuration:
1. Go to Admin → SMS Testing
2. Check configuration status
3. Send test SMS
4. Verify delivery

## Troubleshooting

### Phone Gateway Issues:
- **Connection Timeout**: Check network connectivity and firewall settings
- **Authentication Failed**: Verify API key if required by your gateway app
- **Format Errors**: Ensure your gateway app accepts the JSON format above

### General Issues:
- **Provider Not Configured**: Check that all required environment variables are set
- **Service Initialization Failed**: Check server logs for detailed error messages