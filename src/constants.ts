export const FIELD_FORMATS_DESCRIPTION = `
  Create new content in microCMS and publish it immediately.

  ## Important
  Before starting any content operations, you MUST call microcms_get_api_list to retrieve the list of available endpoints and understand their schemas.
  Ensure that the JSON data in the file strictly adheres to the following specifications.
  In particular, take extra care when handling custom fields and iframe fields, as mistakes are common in their structure.
  Read the instructions thoroughly and construct the data precisely as described.
  In particular, for extended fields (iframe fields), you need to take care to call microcms_get_list tool beforehand, and set its structure to the "data" field (Detail is described below).

  ## Field type specifications

  * Image fields (kind: "media") require a URL string uploaded to microCMS media library (e.g., "https://images.microcms-assets.io/assets/xxx/yyy/sample.png"). When setting media fields, always specify the image URL as a plain string value.
  * Multiple image fields use array format.
  * Rich editor fields expect HTML strings. IMPORTANT: The "richEditor" field type does NOT support HTML content. You MUST use "richEditorV2" for HTML content.
  * Date fields use ISO 8601 format.
  * Select fields use arrays.
  * Content reference fields use contentId strings or arrays for multiple references, and you can get contentIds from microcms_get_list tool.
  * Custom field exepect below struct:
  \`\`\`json
  <field Id in apiFields> {
    "fieldId": "<target custom field id in customFields>"
    "key1": "<value1>",
    "key2": "<value2>",
  }
  \`\`\`
* iframe field (Extension field) expects the following structure for CREATE/UPDATE:
\`\`\`json
  {
    "id": "some-id",
    "title": "some-title",
    "description": "some-description",
    "imageUrl": "https://images.microcms-assets.io/assets/xxxx/yyyy/{fileName}.png",
    "updatedAt": "2024-01-01T00:00:00Z",
    "data": { "key1": "value1", "key2": "value2" }
  }
\`\`\`
  * **IMPORTANT**: When retrieving content via API, only the "data" object content is returned (without the wrapper).
  * **IMPORTANT**: When creating/updating content, you MUST provide the full structure including id, title, description, imageUrl, updatedAt, and data.
  * To understand the "data" structure, ALWAYS use microcms_get_list to retrieve existing content first and examine the field structure.
  * "id", "title", "description", "imageUrl" are metadata displayed in the admin screen and are not included in the API GET response.
  `;
