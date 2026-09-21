import { Customer, Order, OrderItem, Courier, UserSession, ActivityLog } from "@/types/orderflow";

export const INITIAL_COURIERS: Courier[] = [
  { id: "cour-1", name: "ST Courier", code: "ST_COURIER", isStCourier: true, trackingUrlPattern: "https://stcourier.com/track?llr={llr}", active: true },
  { id: "cour-2", name: "Delhivery", code: "DELHIVERY", isStCourier: false, trackingUrlPattern: "https://www.delhivery.com/track/package/{llr}", active: true },
  { id: "cour-3", name: "DTDC", code: "DTDC", isStCourier: false, trackingUrlPattern: "https://www.dtdc.in/tracking/tracking_results.asp?trkid={llr}", active: true },
  { id: "cour-4", name: "Blue Dart", code: "BLUE_DART", isStCourier: false, trackingUrlPattern: "https://www.bluedart.com/tracking?handler=t&awb=awb&numbers={llr}", active: true },
  { id: "cour-5", name: "The Professional Couriers", code: "TPC", isStCourier: false, trackingUrlPattern: "https://www.tpcindia.com/track.aspx?doc_no={llr}", active: true },
];

export const CURRENT_USER: UserSession = {
  id: "usr-admin-01",
  name: "Priya Sundaram",
  email: "priya.operations@orderflow.internal",
  role: "ADMIN",
  avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
  online: true,
};

export const STAFF_USERS: UserSession[] = [
  { id: "usr-1", name: "Priya Sundaram", email: "priya@orderflow.internal", role: "ADMIN", online: true },
  { id: "usr-2", name: "Karthik Rajan", email: "karthik.mgr@orderflow.internal", role: "MANAGER", online: true },
  { id: "usr-3", name: "Deepa Verma", email: "deepa.order@orderflow.internal", role: "ORDER_STAFF", online: true },
  { id: "usr-4", name: "Muthu Kumar", email: "muthu.pack@orderflow.internal", role: "PACKING_STAFF", online: true },
  { id: "usr-5", name: "Saravanan P", email: "saravanan.disp@orderflow.internal", role: "DISPATCH_STAFF", online: true },
];

export const MOCK_CUSTOMERS: Customer[] = [
  { id: "cust-1", name: "Ananya Sharma", mobile: "+91 98201 44521", email: "ananya.s@gmail.com", address: "Flat 402, Sea Green Apts, Worli", city: "Mumbai", state: "Maharashtra", pincode: "400018", totalOrders: 4 },
  { id: "cust-2", name: "Rajesh Patel", mobile: "+91 98450 11982", email: "rajesh.patel@yahoo.com", address: "12, Shanti Nagar, SG Highway", city: "Ahmedabad", state: "Gujarat", pincode: "380054", totalOrders: 2 },
  { id: "cust-3", name: "Sneha Reddy", mobile: "+91 99802 33410", email: "sneha.reddy@outlook.com", address: "45/2 Jubilee Hills, Road No 10", city: "Hyderabad", state: "Telangana", pincode: "500033", totalOrders: 6 },
  { id: "cust-4", name: "Vikram Malhotra", mobile: "+91 98110 55678", email: "v.malhotra@gmail.com", address: "B-24, Greater Kailash Part 1", city: "New Delhi", state: "Delhi", pincode: "110048", totalOrders: 1 },
  { id: "cust-5", name: "Kavita Iyer", mobile: "+91 94441 88920", email: "kavita.iyer@gmail.com", address: "18, 4th Main Road, Gandhi Nagar, Adyar", city: "Chennai", state: "Tamil Nadu", pincode: "600020", totalOrders: 8 },
  { id: "cust-6", name: "Arjun Nair", mobile: "+91 97420 66733", email: "arjun.nair@gmail.com", address: "302, Palm Meadows, Whitefield", city: "Bengaluru", state: "Karnataka", pincode: "560066", totalOrders: 3 },
  { id: "cust-7", name: "Meera Subramanian", mobile: "+91 98402 77123", email: "meera.sub@gmail.com", address: "55, Luz Church Road, Mylapore", city: "Chennai", state: "Tamil Nadu", pincode: "600004", totalOrders: 5 },
  { id: "cust-8", name: "Rohan Kapoor", mobile: "+91 98101 22901", email: "rohan.kapoor@hotmail.com", address: "Tower 3, Nirvana Country, Sector 50", city: "Gurugram", state: "Haryana", pincode: "122018", totalOrders: 2 },
  { id: "cust-9", name: "Pooja Hegde", mobile: "+91 99001 88234", email: "pooja.hegde@gmail.com", address: "88, 100ft Road, Indiranagar", city: "Bengaluru", state: "Karnataka", pincode: "560038", totalOrders: 7 },
  { id: "cust-10", name: "Suresh Narayanan", mobile: "+91 94432 99012", email: "suresh.n@gmail.com", address: "14, West Masi Street", city: "Madurai", state: "Tamil Nadu", pincode: "625001", totalOrders: 3 },
  { id: "cust-11", name: "Divya Joshi", mobile: "+91 98220 33451", email: "divya.joshi@gmail.com", address: "10, Koregaon Park Road", city: "Pune", state: "Maharashtra", pincode: "411001", totalOrders: 4 },
  { id: "cust-12", name: "Alok Sengupta", mobile: "+91 98300 44512", email: "alok.sengupta@rediffmail.com", address: "Flat 2B, Southern Avenue", city: "Kolkata", state: "West Bengal", pincode: "700029", totalOrders: 1 },
  { id: "cust-13", name: "Nandini Rao", mobile: "+91 98455 12098", email: "nandini.rao@gmail.com", address: "23, 7th Cross, Malleshwaram", city: "Bengaluru", state: "Karnataka", pincode: "560003", totalOrders: 5 },
  { id: "cust-14", name: "Gaurav Bhatia", mobile: "+91 98188 77231", email: "gaurav.b@gmail.com", address: "A-99, Sector 15", city: "Noida", state: "Uttar Pradesh", pincode: "201301", totalOrders: 2 },
  { id: "cust-15", name: "Lakshmi Venkatesh", mobile: "+91 94440 33812", email: "lakshmi.venkat@gmail.com", address: "8/12 Raman Street, T. Nagar", city: "Chennai", state: "Tamil Nadu", pincode: "600017", totalOrders: 9 },
  { id: "cust-16", name: "Kunal Shah", mobile: "+91 98205 66782", email: "kunal.shah@gmail.com", address: "401, Vile Parle West", city: "Mumbai", state: "Maharashtra", pincode: "400056", totalOrders: 3 },
  { id: "cust-17", name: "Shalini Menon", mobile: "+91 97450 88210", email: "shalini.menon@gmail.com", address: "Plot 12, Panampilly Nagar", city: "Kochi", state: "Kerala", pincode: "682036", totalOrders: 2 },
  { id: "cust-18", name: "Manoj Agarwal", mobile: "+91 94140 22345", email: "manoj.agarwal@gmail.com", address: "B-12, C-Scheme", city: "Jaipur", state: "Rajasthan", pincode: "302001", totalOrders: 4 },
  { id: "cust-19", name: "Aarti Deshmukh", mobile: "+91 98900 11234", email: "aarti.d@gmail.com", address: "15, Shivaji Nagar", city: "Nagpur", state: "Maharashtra", pincode: "440010", totalOrders: 1 },
  { id: "cust-20", name: "Venkatesh Babu", mobile: "+91 94421 55678", email: "venkat.babu@gmail.com", address: "102, Avinashi Road", city: "Coimbatore", state: "Tamil Nadu", pincode: "641018", totalOrders: 6 },
  { id: "cust-21", name: "Tanvi Choudhury", mobile: "+91 98640 44321", email: "tanvi.c@gmail.com", address: "GS Road, Dispur", city: "Guwahati", state: "Assam", pincode: "781005", totalOrders: 2 },
  { id: "cust-22", name: "Siddharth Kaul", mobile: "+91 98140 99882", email: "siddharth.k@gmail.com", address: "SCO 88, Sector 35-C", city: "Chandigarh", state: "Punjab", pincode: "160035", totalOrders: 3 },
  { id: "cust-23", name: "Radha Krishnan", mobile: "+91 94431 77654", email: "radha.k@gmail.com", address: "25, Thillai Nagar 11th Cross", city: "Tiruchirappalli", state: "Tamil Nadu", pincode: "620018", totalOrders: 4 },
  { id: "cust-24", name: "Manish Tiwari", mobile: "+91 94500 11982", email: "manish.tiwari@gmail.com", address: "45, Hazratganj", city: "Lucknow", state: "Uttar Pradesh", pincode: "226001", totalOrders: 2 },
  { id: "cust-25", name: "Harini Sundar", mobile: "+91 94450 88231", email: "harini.s@gmail.com", address: "17, 1st Avenue, Shastri Nagar", city: "Chennai", state: "Tamil Nadu", pincode: "600020", totalOrders: 7 },
  { id: "cust-26", name: "Nitin Mittal", mobile: "+91 98111 22340", email: "nitin.mittal@gmail.com", address: "55, Civil Lines", city: "Kanpur", state: "Uttar Pradesh", pincode: "208001", totalOrders: 1 },
  { id: "cust-27", name: "Bhavna Patel", mobile: "+91 98250 33412", email: "bhavna.p@gmail.com", address: "14, Alkapuri", city: "Vadodara", state: "Gujarat", pincode: "390007", totalOrders: 3 },
  { id: "cust-28", name: "Gopalakrishnan V", mobile: "+91 94444 11220", email: "gopal.v@gmail.com", address: "3/10, Sannathi Street, Triplicane", city: "Chennai", state: "Tamil Nadu", pincode: "600005", totalOrders: 5 },
  { id: "cust-29", name: "Ritu Singhania", mobile: "+91 98310 99881", email: "ritu.singhania@gmail.com", address: "8, Ballygunge Circular Road", city: "Kolkata", state: "West Bengal", pincode: "700019", totalOrders: 4 },
  { id: "cust-30", name: "Ajay Devgania", mobile: "+91 98200 77651", email: "ajay.dev@gmail.com", address: "702, Bandra West, Perry Cross Road", city: "Mumbai", state: "Maharashtra", pincode: "400050", totalOrders: 2 },
  { id: "cust-31", name: "Deepak Soni", mobile: "+91 94130 55432", email: "deepak.soni@gmail.com", address: "18, Sardarpura B Road", city: "Jodhpur", state: "Rajasthan", pincode: "342003", totalOrders: 2 },
  { id: "cust-32", name: "Padma Balan", mobile: "+91 94470 66543", email: "padma.balan@gmail.com", address: "Vellayambalam", city: "Thiruvananthapuram", state: "Kerala", pincode: "695010", totalOrders: 3 },
  { id: "cust-33", name: "Sunil Pillai", mobile: "+91 98480 33211", email: "sunil.pillai@gmail.com", address: "Plot 30, Banjara Hills Road 3", city: "Hyderabad", state: "Telangana", pincode: "500034", totalOrders: 5 },
  { id: "cust-34", name: "Swati Mukherjee", mobile: "+91 98305 44123", email: "swati.m@gmail.com", address: "Salt Lake Sector 1", city: "Kolkata", state: "West Bengal", pincode: "700064", totalOrders: 2 },
  { id: "cust-35", name: "Vinod Chandran", mobile: "+91 94443 88765", email: "vinod.c@gmail.com", address: "55, 3rd Seaward Road, Valmiki Nagar", city: "Chennai", state: "Tamil Nadu", pincode: "600041", totalOrders: 4 },
  { id: "cust-36", name: "Rashi Bansal", mobile: "+91 98102 33456", email: "rashi.b@gmail.com", address: "Pocket C, Ashok Vihar Phase 1", city: "New Delhi", state: "Delhi", pincode: "110052", totalOrders: 1 },
  { id: "cust-37", name: "Kishore Kumar", mobile: "+91 94425 11982", email: "kishore.k@gmail.com", address: "12, Crosscut Road, Gandhipuram", city: "Coimbatore", state: "Tamil Nadu", pincode: "641012", totalOrders: 8 },
  { id: "cust-38", name: "Geetha Mohan", mobile: "+91 94442 77890", email: "geetha.m@gmail.com", address: "9, North Boag Road, T. Nagar", city: "Chennai", state: "Tamil Nadu", pincode: "600017", totalOrders: 6 },
  { id: "cust-39", name: "Prateek Jain", mobile: "+91 98290 66541", email: "prateek.jain@gmail.com", address: "M.I. Road", city: "Jaipur", state: "Rajasthan", pincode: "302001", totalOrders: 3 },
  { id: "cust-40", name: "Revathi Shankar", mobile: "+91 94433 22110", email: "revathi.s@gmail.com", address: "19, Palace Road", city: "Madurai", state: "Tamil Nadu", pincode: "625001", totalOrders: 5 },
  { id: "cust-41", name: "Hemant Dixit", mobile: "+91 98260 44321", email: "hemant.d@gmail.com", address: "Vijay Nagar", city: "Indore", state: "Madhya Pradesh", pincode: "452010", totalOrders: 2 },
  { id: "cust-42", name: "Aparna Nambiar", mobile: "+91 97440 55432", email: "aparna.n@gmail.com", address: "Beach Road", city: "Kozhikode", state: "Kerala", pincode: "673001", totalOrders: 3 },
  { id: "cust-43", name: "Mahesh Babu", mobile: "+91 98490 88765", email: "mahesh.b@gmail.com", address: "Madhapur", city: "Hyderabad", state: "Telangana", pincode: "500081", totalOrders: 4 },
  { id: "cust-44", name: "Chitra Ananth", mobile: "+91 94445 99881", email: "chitra.a@gmail.com", address: "Velachery Main Road", city: "Chennai", state: "Tamil Nadu", pincode: "600042", totalOrders: 7 },
  { id: "cust-45", name: "Raghavendra Rao", mobile: "+91 98451 22345", email: "raghav.rao@gmail.com", address: "Jayanagar 4th Block", city: "Bengaluru", state: "Karnataka", pincode: "560011", totalOrders: 5 },
  { id: "cust-46", name: "Smriti Irani", mobile: "+91 98202 33455", email: "smriti.i@gmail.com", address: "Altamount Road, Cumballa Hill", city: "Mumbai", state: "Maharashtra", pincode: "400026", totalOrders: 2 },
  { id: "cust-47", name: "Ramesh Babu", mobile: "+91 94430 88712", email: "ramesh.b@gmail.com", address: "Salem Main Road", city: "Salem", state: "Tamil Nadu", pincode: "636001", totalOrders: 4 },
  { id: "cust-48", name: "Urmila Sen", mobile: "+91 98311 44556", email: "urmila.sen@gmail.com", address: "Alipore Park Road", city: "Kolkata", state: "West Bengal", pincode: "700027", totalOrders: 3 },
  { id: "cust-49", name: "Tariq Mansoor", mobile: "+91 98180 66778", email: "tariq.m@gmail.com", address: "Zakir Nagar, Okhla", city: "New Delhi", state: "Delhi", pincode: "110025", totalOrders: 1 },
  { id: "cust-50", name: "Subhashini Ram", mobile: "+91 94441 22334", email: "subha.ram@gmail.com", address: "Anna Nagar West Extension", city: "Chennai", state: "Tamil Nadu", pincode: "600101", totalOrders: 6 },
];

export const MOCK_PRODUCTS: { id: string; name: string; sku: string; price: number; sizes: Array<"XS" | "S" | "M" | "L" | "XL" | "XXL" | "Free Size"> }[] = [
  { id: "p1", name: "Chanderi Silk Anarkali Kurta Set", sku: "OF-CS-ANR-01", price: 2499, sizes: ["S", "M", "L", "XL"] },
  { id: "p2", name: "Pure Lucknowi Chikankari Cotton Kurti", sku: "OF-LKW-CHK-02", price: 1299, sizes: ["XS", "S", "M", "L", "XL", "XXL"] },
  { id: "p3", name: "Kanjivaram Woven Soft Silk Saree", sku: "OF-KNJ-SAREE-03", price: 3899, sizes: ["Free Size"] },
  { id: "p4", name: "Bandhani Print Rayon Flared Kurta", sku: "OF-BDH-FLR-04", price: 999, sizes: ["S", "M", "L", "XL"] },
  { id: "p5", name: "Handloom Linen Mandarin Collar Shirt", sku: "OF-LNN-SHIRT-05", price: 1599, sizes: ["M", "L", "XL", "XXL"] },
  { id: "p6", name: "Stretch Slim-Fit Chinos (Olive)", sku: "OF-CHN-OLV-06", price: 1499, sizes: ["M", "L", "XL"] },
  { id: "p7", name: "Banarasi Zari Border Georgette Saree", sku: "OF-BNR-GRG-07", price: 2999, sizes: ["Free Size"] },
  { id: "p8", name: "Ajrakh Handblock Modal Silk Dupatta", sku: "OF-AJK-DUP-08", price: 849, sizes: ["Free Size"] },
  { id: "p9", name: "Raw Denim Selvedge Relaxed Fit Jeans", sku: "OF-DNM-SLV-09", price: 2199, sizes: ["M", "L", "XL"] },
  { id: "p10", name: "Mulmul Cotton Printed Daily Kurti", sku: "OF-MLM-PRT-10", price: 799, sizes: ["S", "M", "L", "XL", "XXL"] },
  { id: "p11", name: "Embroidered Velvet Party Lehenga Choli", sku: "OF-VLV-LHG-11", price: 6499, sizes: ["M", "L", "XL"] },
  { id: "p12", name: "Classic Cotton Linen Short Kurta (White)", sku: "OF-LNN-SHT-12", price: 1199, sizes: ["S", "M", "L", "XL"] },
];

function generateOrderItems(seed: number): OrderItem[] {
  const count = (seed % 3) + 1;
  const items: OrderItem[] = [];
  for (let i = 0; i < count; i++) {
    const prod = MOCK_PRODUCTS[(seed + i) % MOCK_PRODUCTS.length];
    const size = prod.sizes[(seed + i) % prod.sizes.length];
    const qty = (seed % 2) + 1;
    items.push({
      id: `item-${seed}-${i}`,
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      size,
      quantity: qty,
      unitPrice: prod.price,
      subtotal: prod.price * qty,
    });
  }
  return items;
}

// Generate exactly 102 comprehensive orders meeting all specification requirements
export function generateMockOrders(): Order[] {
  const orders: Order[] = [];
  const baseDate = new Date("2026-09-21T08:00:00+05:30");

  for (let i = 1; i <= 102; i++) {
    const custIndex = (i - 1) % MOCK_CUSTOMERS.length;
    const customer = MOCK_CUSTOMERS[custIndex];
    const items = generateOrderItems(i);
    const totalAmount = items.reduce((sum, it) => sum + it.subtotal, 0);
    const isWebsite = i % 2 === 1;
    const source = isWebsite ? "WEBSITE" : "WHATSAPP";
    const externalOrderId = isWebsite ? `WC-${10400 + i}` : `WA-CHAT-${8200 + i}`;
    const orderNumber = `OF-${9000 + i}`;

    // Timestamp calculation
    const minutesAgo = (102 - i) * 18 + (i % 7) * 4;
    const createdAt = new Date(baseDate.getTime() - minutesAgo * 60 * 1000).toISOString();
    let updatedAt = createdAt;

    // Distribute statuses according to exact prompt action items:
    // Prompt specific counts:
    // - 8 orders waiting for packing (CONFIRMED)
    // - 4 packed orders waiting for dispatch (PACKED)
    // - 6 dispatched orders with SMS pending
    // - 3 SMS failed
    // - 5 ST Courier orders missing LLR

    let orderStatus: Order["orderStatus"] = "NEW";
    let courierId = "cour-1"; // ST Courier by default for many
    let courierName = "ST Courier";
    let isSt = true;
    let llrNumber: string | undefined = undefined;
    let courierStatus: Order["dispatch"]["courierStatus"] = "PENDING";
    let smsStatus: Order["sms"]["status"] = "PENDING";
    let smsMsgId: string | undefined = undefined;
    let confirmedAt: string | undefined = undefined;
    let packingStartedAt: string | undefined = undefined;
    let packedAt: string | undefined = undefined;
    let dispatchedAt: string | undefined = undefined;
    let packingStaff: string | undefined = undefined;

    // Courier selection
    if (i % 3 === 0) {
      courierId = "cour-2";
      courierName = "Delhivery";
      isSt = false;
    } else if (i % 5 === 0) {
      courierId = "cour-3";
      courierName = "DTDC";
      isSt = false;
    } else if (i % 7 === 0) {
      courierId = "cour-4";
      courierName = "Blue Dart";
      isSt = false;
    }

    // Explicit Status Assignment:
    if (i <= 12) {
      // 12 NEW orders
      orderStatus = "NEW";
      courierStatus = "PENDING";
      smsStatus = "PENDING";
    } else if (i <= 20) {
      // Exactly 8 CONFIRMED orders waiting for packing!
      orderStatus = "CONFIRMED";
      confirmedAt = new Date(new Date(createdAt).getTime() + 15 * 60 * 1000).toISOString();
      updatedAt = confirmedAt;
      courierStatus = "PENDING";
      smsStatus = "PENDING";
    } else if (i <= 27) {
      // 7 PACKING orders
      orderStatus = "PACKING";
      confirmedAt = new Date(new Date(createdAt).getTime() + 15 * 60 * 1000).toISOString();
      packingStartedAt = new Date(new Date(confirmedAt).getTime() + 25 * 60 * 1000).toISOString();
      packingStaff = "Muthu Kumar";
      updatedAt = packingStartedAt;
      courierStatus = "PENDING";
      smsStatus = "PENDING";
    } else if (i <= 31) {
      // Exactly 4 PACKED orders waiting for dispatch!
      orderStatus = "PACKED";
      confirmedAt = new Date(new Date(createdAt).getTime() + 10 * 60 * 1000).toISOString();
      packingStartedAt = new Date(new Date(confirmedAt).getTime() + 20 * 60 * 1000).toISOString();
      packedAt = new Date(new Date(packingStartedAt).getTime() + 18 * 60 * 1000).toISOString();
      packingStaff = "Muthu Kumar";
      updatedAt = packedAt;
      courierStatus = "PENDING";
      smsStatus = "PENDING";
    } else {
      // Remaining are DISPATCHED (orders 32 to 102 = 71 dispatched orders)
      orderStatus = "DISPATCHED";
      confirmedAt = new Date(new Date(createdAt).getTime() + 10 * 60 * 1000).toISOString();
      packingStartedAt = new Date(new Date(confirmedAt).getTime() + 25 * 60 * 1000).toISOString();
      packedAt = new Date(new Date(packingStartedAt).getTime() + 15 * 60 * 1000).toISOString();
      dispatchedAt = new Date(new Date(packedAt).getTime() + 45 * 60 * 1000).toISOString();
      packingStaff = "Muthu Kumar";
      updatedAt = dispatchedAt;

      // Assign LLR and Courier status
      // We need exactly 5 ST Courier orders missing LLR (let's assign orders 32, 33, 34, 35, 36 to ST Courier without LLR!)
      if (i >= 32 && i <= 36) {
        courierId = "cour-1";
        courierName = "ST Courier";
        isSt = true;
        llrNumber = undefined; // Missing LLR!
        courierStatus = "PENDING";
      } else {
        llrNumber = isSt ? `STC${800000 + i}` : `TRK${900000 + i}`;
        courierStatus = i % 4 === 0 ? "SHIPPED" : "PENDING";
      }

      // SMS status handling:
      // We need exactly 6 dispatched orders with SMS pending (orders 37, 38, 39, 40, 41, 42)
      // and exactly 3 SMS failed (orders 43, 44, 45)
      // all others SENT
      if (i >= 37 && i <= 42) {
        smsStatus = "PENDING";
        smsMsgId = `PING-REQ-${77000 + i}`;
      } else if (i >= 43 && i <= 45) {
        smsStatus = "FAILED";
        smsMsgId = `PING-ERR-${77000 + i}`;
      } else {
        smsStatus = "SENT";
        smsMsgId = `PING-DELIV-${77000 + i}`;
      }
    }

    // Build timeline logs
    const timeline: ActivityLog[] = [
      {
        id: `tl-${i}-1`,
        orderId: `ord-${i}`,
        timestamp: createdAt,
        user: source === "WEBSITE" ? "WooCommerce Webhook" : "WhatsApp Chat Box",
        role: "ORDER_STAFF",
        action: "Order Created",
        details: `Imported from ${source} (${externalOrderId})`,
      },
    ];

    if (confirmedAt) {
      timeline.push({
        id: `tl-${i}-2`,
        orderId: `ord-${i}`,
        timestamp: confirmedAt,
        user: "Deepa Verma",
        role: "ORDER_STAFF" as const,
        action: "Order Confirmed",
        details: "Customer address and items verified",
      });
    }

    if (packingStartedAt) {
      timeline.push({
        id: `tl-${i}-3`,
        orderId: `ord-${i}`,
        timestamp: packingStartedAt,
        user: packingStaff || "Muthu Kumar",
        role: "PACKING_STAFF" as const,
        action: "Packing Started",
        details: "Assigned to packing bin #B" + ((i % 12) + 1),
      });
    }

    if (packedAt) {
      timeline.push({
        id: `tl-${i}-4`,
        orderId: `ord-${i}`,
        timestamp: packedAt,
        user: packingStaff || "Muthu Kumar",
        role: "PACKING_STAFF" as const,
        action: "Order Packed",
        details: "Quality check passed, polybag sealed",
      });
    }

    if (dispatchedAt) {
      timeline.push({
        id: `tl-${i}-5`,
        orderId: `ord-${i}`,
        timestamp: dispatchedAt,
        user: "Saravanan P",
        role: "DISPATCH_STAFF" as const,
        action: "Order Dispatched",
        details: `Handed over to ${courierName}${llrNumber ? ` (LLR: ${llrNumber})` : " (LLR Pending)"}`,
      });

      if (courierStatus === "SHIPPED") {
        timeline.push({
          id: `tl-${i}-6`,
          orderId: `ord-${i}`,
          timestamp: new Date(new Date(dispatchedAt).getTime() + 15 * 60 * 1000).toISOString(),
          user: "Saravanan P",
          role: "DISPATCH_STAFF" as const,
          action: "Order Shipped",
          details: `In transit via ${courierName}${llrNumber ? ` (LLR: ${llrNumber})` : ""}`,
        });

        timeline.push({
          id: `tl-${i}-7`,
          orderId: `ord-${i}`,
          timestamp: new Date(new Date(dispatchedAt).getTime() + 18 * 60 * 1000).toISOString(),
          user: "Ping4SMS Gateway",
          role: "SYSTEM" as const,
          action: "SMS Sent",
          details: `Tracking SMS sent to customer ${customer.mobile} (MsgID: ${smsMsgId || "P4S-SHIP-770" + i})`,
        });
      } else if (smsStatus && smsStatus !== "PENDING") {
        timeline.push({
          id: `tl-${i}-6`,
          orderId: `ord-${i}`,
          timestamp: new Date(new Date(dispatchedAt).getTime() + 2 * 60 * 1000).toISOString(),
          user: "Ping4SMS Service",
          role: "MANAGER" as const,
          action: "SMS Status Updated",
          details: `Delivery telemetry status: ${smsStatus} (MsgID: ${smsMsgId || "N/A"})`,
        });
      }
    }

    orders.push({
      id: `ord-${i}`,
      orderNumber,
      externalOrderId,
      source,
      customer,
      items,
      totalAmount,
      paymentStatus: i % 3 === 0 ? "COD" : "PAID",
      orderStatus,
      dispatch: {
        courierId,
        courierName,
        llrNumber,
        courierStatus,
        dispatchedAt,
        deliveredAt: (courierStatus === "SHIPPED" || (courierStatus as string) === "DELIVERED") ? new Date(new Date(dispatchedAt || createdAt).getTime() + 24 * 3600 * 1000).toISOString() : undefined,
      },
      sms: {
        status: smsStatus,
        provider: "Ping4SMS",
        providerMessageId: smsMsgId,
        sentAt: dispatchedAt ? new Date(new Date(dispatchedAt).getTime() + 60 * 1000).toISOString() : undefined,
        deliveredAt: smsStatus === "SENT" && dispatchedAt ? new Date(new Date(dispatchedAt).getTime() + 180 * 1000).toISOString() : undefined,
        lastCheckedAt: updatedAt,
        responseSnippet: smsStatus === "FAILED" ? "FAILED: DND active or invalid handset route" : smsStatus === "SENT" ? "DELIVRD: Handset acknowledged" : "QUEUED: Awaiting telco delivery report",
      },
      createdAt,
      updatedAt,
      confirmedAt,
      packingStartedAt,
      packedAt,
      dispatchedAt,
      packingStaff,
      notes: i % 7 === 0 ? "Customer requested express packaging" : undefined,
      timeline,
    });
  }

  return orders;
}
