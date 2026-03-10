import { faker } from '@faker-js/faker';

interface FieldMapping {
  pattern: RegExp;
  generate: () => unknown;
}

/**
 * Heuristic field name -> faker method mapping.
 * Checked before falling back to pure type-based generation.
 */
const FIELD_MAPPINGS: FieldMapping[] = [
  // IDs
  { pattern: /^_?id$/i, generate: () => faker.string.uuid() },
  { pattern: /Id$/,     generate: () => faker.string.uuid() },

  // Person
  { pattern: /^(first_?name|fname)$/i,   generate: () => faker.person.firstName() },
  { pattern: /^(last_?name|lname)$/i,    generate: () => faker.person.lastName() },
  { pattern: /^(full_?name|display_?name|name|author|owner)$/i, generate: () => faker.person.fullName() },
  { pattern: /^(username|user_?name|login|handle)$/i, generate: () => faker.internet.username() },

  // Contact
  { pattern: /email/i,           generate: () => faker.internet.email() },
  { pattern: /^phone/i,          generate: () => faker.phone.number() },
  { pattern: /^(tel|telephone)$/i, generate: () => faker.phone.number() },

  // Internet
  { pattern: /^(url|website|link|href|homepage)$/i, generate: () => faker.internet.url() },
  { pattern: /^(avatar|photo|picture|image_?url|profile_?image|thumbnail)$/i, generate: () => faker.image.avatar() },
  { pattern: /^(ip|ip_?address)$/i, generate: () => faker.internet.ip() },
  { pattern: /^(domain|hostname)$/i, generate: () => faker.internet.domainName() },
  { pattern: /^password$/i,     generate: () => faker.internet.password() },

  // Location
  { pattern: /^(address|street|street_?address)$/i, generate: () => faker.location.streetAddress() },
  { pattern: /^city$/i,         generate: () => faker.location.city() },
  { pattern: /^(state|province|region)$/i, generate: () => faker.location.state() },
  { pattern: /^(country)$/i,    generate: () => faker.location.country() },
  { pattern: /^(country_?code)$/i, generate: () => faker.location.countryCode() },
  { pattern: /^(zip|zip_?code|postal|postal_?code)$/i, generate: () => faker.location.zipCode() },
  { pattern: /^(lat|latitude)$/i,  generate: () => faker.location.latitude() },
  { pattern: /^(lng|lon|long|longitude)$/i, generate: () => faker.location.longitude() },

  // Text
  { pattern: /^(title|subject|headline)$/i, generate: () => faker.lorem.sentence() },
  { pattern: /^(description|bio|about|summary|content|body|text|note|comment|message|excerpt)$/i, generate: () => faker.lorem.paragraph() },
  { pattern: /^slug$/i,         generate: () => faker.lorem.slug() },
  { pattern: /^tag$/i,          generate: () => faker.lorem.word() },

  // Commerce
  { pattern: /^(price|cost|amount|total|subtotal|fee|salary|balance|revenue)$/i, generate: () => faker.number.float({ min: 1, max: 9999, fractionDigits: 2 }) },
  { pattern: /^(currency)$/i,   generate: () => faker.finance.currencyCode() },
  { pattern: /^(product_?name|item_?name)$/i, generate: () => faker.commerce.productName() },
  { pattern: /^(category)$/i,   generate: () => faker.commerce.department() },
  { pattern: /^(brand|manufacturer)$/i, generate: () => faker.company.name() },

  // Company
  { pattern: /^(company|company_?name|organization|org)$/i, generate: () => faker.company.name() },
  { pattern: /^(job_?title|position|role)$/i, generate: () => faker.person.jobTitle() },

  // Numbers
  { pattern: /^(age)$/i,        generate: () => faker.number.int({ min: 18, max: 80 }) },
  { pattern: /^(count|quantity|qty|stock)$/i, generate: () => faker.number.int({ min: 0, max: 100 }) },
  { pattern: /^(rating|score)$/i, generate: () => faker.number.float({ min: 0, max: 5, fractionDigits: 1 }) },
  { pattern: /^(weight)$/i,     generate: () => faker.number.float({ min: 0.1, max: 100, fractionDigits: 1 }) },
  { pattern: /^(height|width|length|size|duration)$/i, generate: () => faker.number.int({ min: 1, max: 1000 }) },
  { pattern: /^(page|page_?number)$/i, generate: () => faker.number.int({ min: 1, max: 100 }) },
  { pattern: /^(limit|per_?page|page_?size)$/i, generate: () => faker.helpers.arrayElement([10, 20, 25, 50]) },
  { pattern: /^(total|total_?count|total_?items)$/i, generate: () => faker.number.int({ min: 0, max: 1000 }) },
  { pattern: /^(percentage|percent|progress)$/i, generate: () => faker.number.int({ min: 0, max: 100 }) },
  { pattern: /^(order|sort_?order|priority|index|position|rank|level)$/i, generate: () => faker.number.int({ min: 1, max: 10 }) },
  { pattern: /^(version)$/i,    generate: () => faker.system.semver() },

  // Date/Time
  { pattern: /^(created_?at|created_?date|created|date_?created)$/i, generate: () => faker.date.past().toISOString() },
  { pattern: /^(updated_?at|updated_?date|modified_?at|modified|last_?modified)$/i, generate: () => faker.date.recent().toISOString() },
  { pattern: /^(deleted_?at|archived_?at)$/i, generate: () => faker.date.recent().toISOString() },
  { pattern: /^(published_?at|publish_?date)$/i, generate: () => faker.date.past().toISOString() },
  { pattern: /^(start_?date|start_?time|begin|from)$/i, generate: () => faker.date.past().toISOString() },
  { pattern: /^(end_?date|end_?time|until|to|deadline|due_?date|expires_?at|expiry)$/i, generate: () => faker.date.future().toISOString() },
  { pattern: /^(birth_?date|dob|birthday)$/i, generate: () => faker.date.birthdate().toISOString().split('T')[0] },
  { pattern: /^(date|time|timestamp|datetime)$/i, generate: () => faker.date.recent().toISOString() },

  // Boolean
  { pattern: /^(is_?active|active|enabled|is_?enabled)$/i, generate: () => faker.datatype.boolean() },
  { pattern: /^(is_?verified|verified|confirmed|is_?confirmed)$/i, generate: () => faker.datatype.boolean() },
  { pattern: /^(is_?deleted|deleted|is_?archived|archived)$/i, generate: () => false },
  { pattern: /^(is_?admin|is_?public|is_?visible|visible|published|approved)$/i, generate: () => faker.datatype.boolean() },

  // Status
  { pattern: /^(status)$/i,     generate: () => faker.helpers.arrayElement(['active', 'inactive', 'pending', 'archived']) },
  { pattern: /^(type|kind)$/i,  generate: () => faker.helpers.arrayElement(['standard', 'premium', 'basic']) },
  { pattern: /^(gender|sex)$/i, generate: () => faker.helpers.arrayElement(['male', 'female', 'other']) },
  { pattern: /^(locale|language|lang)$/i, generate: () => faker.helpers.arrayElement(['en', 'vi', 'ja', 'ko', 'zh']) },

  // Codes
  { pattern: /^(sku|code|product_?code)$/i, generate: () => faker.string.alphanumeric(8).toUpperCase() },
  { pattern: /^(token|access_?token|refresh_?token|api_?key)$/i, generate: () => faker.string.alphanumeric(32) },
  { pattern: /^(color|colour)$/i, generate: () => faker.color.rgb() },
];

/**
 * Try to find a faker method based on field name heuristics.
 * Returns undefined if no match found.
 */
export function generateByFieldName(fieldName: string): unknown | undefined {
  for (const mapping of FIELD_MAPPINGS) {
    if (mapping.pattern.test(fieldName)) {
      return mapping.generate();
    }
  }
  return undefined;
}
