import { Customer, Order, OrderItem, Courier, UserSession, ActivityLog, ReturnCase } from "@/types/orderflow";

export const INITIAL_COURIERS: Courier[] = [
  { id: "cour-1", name: "ST Courier", code: "ST_COURIER", isStCourier: true, trackingUrlPattern: "https://stcourier.com/track?llr={llr}", active: true },
  { id: "cour-2", name: "Professional Courier", code: "PROFESSIONAL", isStCourier: false, trackingUrlPattern: "https://www.tpcindia.com/track.aspx?doc_no={llr}", active: true },
  { id: "cour-3", name: "DTDC", code: "DTDC", isStCourier: false, trackingUrlPattern: "https://www.dtdc.in/tracking/tracking_results.asp?trkid={llr}", active: true },
];

export const CURRENT_USER: UserSession = {
  id: "usr-admin-01",
  name: "Admin",
  email: "admin@orderflow.internal",
  role: "ADMIN",
  avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
  online: true,
};

export const STAFF_USERS: UserSession[] = [
  { id: "usr-1", name: "Admin", email: "admin@orderflow.internal", role: "ADMIN", online: true },
  { id: "usr-2", name: "Karthik Rajan", email: "karthik.mgr@orderflow.internal", role: "MANAGER", online: true },
  { id: "usr-3", name: "Deepa Verma", email: "deepa.order@orderflow.internal", role: "ORDER_STAFF", online: true },
  { id: "usr-4", name: "Muthu Kumar", email: "muthu.pack@orderflow.internal", role: "PACKING_STAFF", online: true },
  { id: "usr-5", name: "Saravanan P", email: "saravanan.disp@orderflow.internal", role: "DISPATCH_STAFF", online: true },
  { id: "usr-st", name: "ST Courier Portal", email: "portal@stcourier.in", role: "COURIER", courierPartnerId: "ST_COURIER", online: true },
  { id: "usr-prof", name: "Professional Courier Portal", email: "portal@tpcindia.com", role: "COURIER", courierPartnerId: "PROFESSIONAL", online: true },
  { id: "usr-dtdc", name: "DTDC Hub Portal", email: "portal@dtdc.com", role: "COURIER", courierPartnerId: "DTDC", online: true },
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
    let courierId: string | undefined = undefined;
    let courierName: string | undefined = undefined;
    let isSt = false;
    let llrNumber: string | undefined = undefined;
    let courierStatus: Order["dispatch"]["courierStatus"] = "PENDING";
    let smsStatus: Order["sms"]["status"] = "PENDING";
    let smsMsgId: string | undefined = undefined;
    let confirmedAt: string | undefined = undefined;
    let packingStartedAt: string | undefined = undefined;
    let packedAt: string | undefined = undefined;
    let dispatchedAt: string | undefined = undefined;
    let packingStaff: string | undefined = undefined;

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
      courierStatus = "WAITING_FOR_PICKUP";
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

      // Courier Partner assignment: ST Courier (majority), Professional Courier, DTDC, or Unassigned
      let courierPartnerId: string | undefined = "ST_COURIER";
      if (i % 7 === 0) {
        courierId = "cour-2";
        courierName = "Professional Courier";
        courierPartnerId = "PROFESSIONAL";
        isSt = false;
      } else if (i % 5 === 0) {
        courierId = "cour-3";
        courierName = "DTDC";
        courierPartnerId = "DTDC";
        isSt = false;
      } else if (i === 101) {
        courierId = "unassigned";
        courierName = "Unassigned";
        courierPartnerId = undefined;
        isSt = false;
      } else {
        courierId = "cour-1";
        courierName = "ST Courier";
        courierPartnerId = "ST_COURIER";
        isSt = true;
      }

      // Assign LLR, Pickup Phone, and Courier Status
      let pickupPhone: string | undefined = undefined;
      const dispSeq = String(i - 31).padStart(3, "0");
      const dispatchId = `DSP-260922-${dispSeq}`;

      if (i >= 32 && i <= 36) {
        // Missing LLR, Waiting for Pickup
        llrNumber = undefined;
        courierStatus = "WAITING_FOR_PICKUP";
        pickupPhone = undefined;
      } else if (i % 4 === 0) {
        // Delivered
        llrNumber = isSt ? `ST${100000 + i}` : courierPartnerId === "PROFESSIONAL" ? `TPC${200000 + i}` : `DTDC${300000 + i}`;
        courierStatus = "DELIVERED";
        pickupPhone = "+91 98410 23456";
      } else if (i % 2 === 0) {
        // Picked Up
        llrNumber = isSt ? `ST${100000 + i}` : courierPartnerId === "PROFESSIONAL" ? `TPC${200000 + i}` : `DTDC${300000 + i}`;
        courierStatus = "PICKED_UP";
        pickupPhone = "+91 91234 56789";
      } else {
        // Waiting for Pickup with LLR pre-printed
        llrNumber = isSt ? `ST${100000 + i}` : courierPartnerId === "PROFESSIONAL" ? `TPC${200000 + i}` : `DTDC${300000 + i}`;
        courierStatus = "WAITING_FOR_PICKUP";
        pickupPhone = undefined;
      }

      // SMS status handling
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

    // Build chronological timeline logs (Flipkart / Amazon style with real events)
    const timeline: ActivityLog[] = [
      {
        id: `tl-${i}-1`,
        orderId: `ord-${i}`,
        timestamp: createdAt,
        user: source === "WEBSITE" ? "Website" : "WhatsApp",
        role: "ORDER_STAFF",
        action: "Order created",
        details: source === "WEBSITE" ? "Order received from website" : "Order received from WhatsApp",
      },
    ];

    if (confirmedAt) {
      timeline.push({
        id: `tl-${i}-2`,
        orderId: `ord-${i}`,
        timestamp: confirmedAt,
        user: "Staff",
        role: "ORDER_STAFF",
        action: "Order confirmed",
        details: "Order confirmed by staff",
      });
    }

    if (packingStartedAt) {
      timeline.push({
        id: `tl-${i}-3`,
        orderId: `ord-${i}`,
        timestamp: packingStartedAt,
        user: packingStaff || "Muthu Kumar",
        role: "PACKING_STAFF",
        action: "Packing started",
        details: "Packing started at warehouse station",
      });
    }

    if (packedAt) {
      timeline.push({
        id: `tl-${i}-4`,
        orderId: `ord-${i}`,
        timestamp: packedAt,
        user: packingStaff || "Muthu Kumar",
        role: "PACKING_STAFF",
        action: "Order packed",
        details: "Order packed",
      });
    }

    if (dispatchedAt) {
      timeline.push({
        id: `tl-${i}-5`,
        orderId: `ord-${i}`,
        timestamp: dispatchedAt,
        user: "Packing Staff",
        role: "PACKING_STAFF",
        action: "Order dispatched",
        details: "Sent to courier pickup",
      });

      timeline.push({
        id: `tl-${i}-5b`,
        orderId: `ord-${i}`,
        timestamp: new Date(new Date(dispatchedAt).getTime() + 60 * 1000).toISOString(),
        user: "Courier Hub",
        role: "DISPATCH_STAFF",
        action: "Courier pickup waiting",
        details: `Courier: ${courierName}`,
      });

      if (courierStatus === "PICKED_UP" || courierStatus === "DELIVERED") {
        timeline.push({
          id: `tl-${i}-6`,
          orderId: `ord-${i}`,
          timestamp: new Date(new Date(dispatchedAt).getTime() + 20 * 60 * 1000).toISOString(),
          user: courierName || "Courier Staff",
          role: "DISPATCH_STAFF",
          action: "Courier picked up",
          details: `LLR: ${llrNumber || "N/A"}${courierName ? ` · ${courierName}` : ""}`,
        });

        if (smsStatus === "SENT") {
          timeline.push({
            id: `tl-${i}-7`,
            orderId: `ord-${i}`,
            timestamp: new Date(new Date(dispatchedAt).getTime() + 22 * 60 * 1000).toISOString(),
            user: "Ping4SMS",
            role: "SYSTEM",
            action: "SMS sent",
            details: "Customer notification sent",
          });
        }
      }

      if (courierStatus === "DELIVERED") {
        timeline.push({
          id: `tl-${i}-8`,
          orderId: `ord-${i}`,
          timestamp: new Date(new Date(dispatchedAt).getTime() + 24 * 3600 * 1000).toISOString(),
          user: courierName || "Courier Staff",
          role: "DISPATCH_STAFF",
          action: "Delivered",
          details: "Parcel delivered to customer",
        });
      }
    }

    const dispSeq = String(Math.max(1, i - 31)).padStart(3, "0");
    const dispatchId = orderStatus === "DISPATCHED" ? `DSP-260922-${dispSeq}` : undefined;
    const courierPartnerId = 
      courierName === "Professional Courier" ? "PROFESSIONAL" :
      courierName === "DTDC" ? "DTDC" :
      courierName === "Unassigned" ? undefined : "ST_COURIER";

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
        courierPartnerId,
        dispatchId,
        llrNumber,
        pickupPhone: (courierStatus === "PICKED_UP" || courierStatus === "DELIVERED") ? "+91 91234 56789" : undefined,
        courierStatus,
        dispatchedAt,
        pickedUpAt: (courierStatus === "PICKED_UP" || courierStatus === "DELIVERED") ? new Date(new Date(dispatchedAt || createdAt).getTime() + 20 * 60 * 1000).toISOString() : undefined,
        deliveredAt: courierStatus === "DELIVERED" ? new Date(new Date(dispatchedAt || createdAt).getTime() + 24 * 3600 * 1000).toISOString() : undefined,
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

export function generateMockReturns(orders: Order[] = []): ReturnCase[] {
  return [];
  const getOrder = (idx: number, fallbackNumber: string) => {
    return orders[idx] || {
      id: `ord-${idx + 1}`,
      orderNumber: fallbackNumber,
      externalOrderId: `SC-WC-1777${idx + 1}`,
      customer: MOCK_CUSTOMERS[idx % MOCK_CUSTOMERS.length],
      items: [
        {
          id: `it-${idx + 1}`,
          productId: "p1",
          productName: "Double Pocket Shirt - Black",
          sku: "SC-DPS-BLK",
          size: "XL" as const,
          quantity: 2,
          unitPrice: 488,
          subtotal: 976,
        },
      ],
      totalAmount: 976,
      dispatch: {
        llrNumber: "LLR-892112",
        courierName: "ST Courier",
      },
    };
  };

  const o1 = getOrder(34, "OF-9035"); // Praveen
  const o2 = getOrder(5, "OF-9006"); // Arjun Nair
  const o3 = getOrder(6, "OF-9007"); // Meera
  const o4 = getOrder(7, "OF-9008"); // Rohan
  const o5 = getOrder(8, "OF-9009"); // Pooja
  const o6 = getOrder(9, "OF-9010"); // Suresh

  const now = new Date();
  const todayStr = now.toISOString();
  const yesterdayStr = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
  const twoDaysAgoStr = new Date(now.getTime() - 48 * 3600 * 1000).toISOString();

  return [
    {
      id: "rtn-case-1",
      returnId: "RTN-260923-001",
      orderId: o1.id,
      orderNumber: o1.orderNumber,
      customerId: o1.customer.id,
      customerName: o1.customer.name,
      customerPhone: o1.customer.mobile,
      returnType: "Refund",
      reason: "Size Issue",
      customerNote: "Shirt is too loose around shoulders, need refund.",
      status: "Awaiting Return",
      requestedQuantity: 1,
      receivedQuantity: 0,
      approvedQuantity: 0,
      expectedAmount: 488,
      refundAmount: 488,
      discountAdjustment: 0,
      shippingAdjustment: 0,
      items: [
        {
          id: "rtn-it-1",
          orderItemId: o1.items[0]?.id || "it-1",
          productName: "Double Pocket Shirt - Black",
          sku: "SC-DPS-BLK",
          color: "Black",
          size: "XL",
          purchasedQuantity: 2,
          requestedQuantity: 1,
          receivedQuantity: 0,
          approvedQuantity: 0,
          unitPrice: 488,
          returnAmount: 488,
        },
      ],
      timeline: [
        {
          id: "tl-rtn-1-1",
          returnId: "rtn-case-1",
          action: "Return Requested",
          user: "Admin",
          role: "ADMIN",
          notes: "Customer contacted via WhatsApp requesting return for size issue",
          timestamp: yesterdayStr,
        },
        {
          id: "tl-rtn-1-2",
          returnId: "rtn-case-1",
          action: "Return Approved",
          user: "Admin",
          role: "ADMIN",
          notes: "Return approved. Return shipping instructions dispatched to customer",
          timestamp: new Date(new Date(yesterdayStr).getTime() + 25 * 60 * 1000).toISOString(),
        },
        {
          id: "tl-rtn-1-3",
          returnId: "rtn-case-1",
          action: "Awaiting Return",
          user: "System",
          role: "SYSTEM",
          notes: "Pickup scheduled with courier partner",
          timestamp: new Date(new Date(yesterdayStr).getTime() + 40 * 60 * 1000).toISOString(),
        },
      ],
      createdAt: yesterdayStr,
      updatedAt: todayStr,
      createdBy: "Admin",
    },
    {
      id: "rtn-case-2",
      returnId: "RTN-260923-002",
      orderId: o2.id,
      orderNumber: o2.orderNumber,
      customerId: o2.customer.id,
      customerName: o2.customer.name,
      customerPhone: o2.customer.mobile,
      returnType: "Refund",
      reason: "Color Issue",
      customerNote: "Color shade is slightly different from product photos.",
      status: "Return Requested",
      requestedQuantity: 1,
      receivedQuantity: 0,
      approvedQuantity: 0,
      expectedAmount: 1499,
      refundAmount: 1499,
      discountAdjustment: 0,
      shippingAdjustment: 0,
      items: [
        {
          id: "rtn-it-2",
          orderItemId: o2.items[0]?.id || "it-2",
          productName: "Stretch Slim-Fit Chinos (Olive)",
          sku: "OF-CHN-OLV-06",
          color: "Olive",
          size: "L",
          purchasedQuantity: 1,
          requestedQuantity: 1,
          receivedQuantity: 0,
          approvedQuantity: 0,
          unitPrice: 1499,
          returnAmount: 1499,
        },
      ],
      timeline: [
        {
          id: "tl-rtn-2-1",
          returnId: "rtn-case-2",
          action: "Return Requested",
          user: "Deepa Verma",
          role: "ORDER_STAFF",
          notes: "Customer initiated return ticket online",
          timestamp: todayStr,
        },
      ],
      createdAt: todayStr,
      updatedAt: todayStr,
      createdBy: "Deepa Verma",
    },
    {
      id: "rtn-case-3",
      returnId: "RTN-260923-003",
      orderId: o3.id,
      orderNumber: o3.orderNumber,
      customerId: o3.customer.id,
      customerName: o3.customer.name,
      customerPhone: o3.customer.mobile,
      returnType: "Refund",
      reason: "Wrong Product",
      customerNote: "Received 2 pieces in order, but one was different pattern.",
      status: "QC Pending",
      requestedQuantity: 2,
      receivedQuantity: 1, // Short Qty demonstration!
      approvedQuantity: 0,
      expectedAmount: 2598,
      refundAmount: 1299,
      discountAdjustment: 0,
      shippingAdjustment: 0,
      receivedAt: todayStr,
      receivedBy: "Suresh Dispatch",
      receivingNote: "Received parcel from ST Courier. Expected 2 pcs, package only contained 1 pc (Short Qty: 1).",
      items: [
        {
          id: "rtn-it-3",
          orderItemId: o3.items[0]?.id || "it-3",
          productName: "Pure Lucknowi Chikankari Cotton Kurti",
          sku: "OF-LKW-CHK-02",
          color: "Peach",
          size: "M",
          purchasedQuantity: 2,
          requestedQuantity: 2,
          receivedQuantity: 1,
          approvedQuantity: 0,
          unitPrice: 1299,
          returnAmount: 2598,
        },
      ],
      timeline: [
        {
          id: "tl-rtn-3-1",
          returnId: "rtn-case-3",
          action: "Return Requested",
          user: "Admin",
          role: "ADMIN",
          notes: "Customer reported mismatch",
          timestamp: yesterdayStr,
        },
        {
          id: "tl-rtn-3-2",
          returnId: "rtn-case-3",
          action: "Return Approved",
          user: "Admin",
          role: "ADMIN",
          notes: "Return approved",
          timestamp: yesterdayStr,
        },
        {
          id: "tl-rtn-3-3",
          returnId: "rtn-case-3",
          action: "Return Received",
          user: "Suresh Dispatch",
          role: "DISPATCH_STAFF",
          notes: "Parcel arrived at hub with 1 piece (Short Qty: 1)",
          timestamp: todayStr,
        },
        {
          id: "tl-rtn-3-4",
          returnId: "rtn-case-3",
          action: "QC Pending",
          user: "System",
          role: "SYSTEM",
          notes: "Sent to warehouse QC desk for fabric and tag inspection",
          timestamp: todayStr,
        },
      ],
      createdAt: yesterdayStr,
      updatedAt: todayStr,
      createdBy: "Admin",
    },
    {
      id: "rtn-case-4",
      returnId: "RTN-260923-004",
      orderId: o4.id,
      orderNumber: o4.orderNumber,
      customerId: o4.customer.id,
      customerName: o4.customer.name,
      customerPhone: o4.customer.mobile,
      returnType: "Refund",
      reason: "Quality Issue",
      customerNote: "Stitching on left sleeve unraveled.",
      status: "Refund Pending",
      requestedQuantity: 1,
      receivedQuantity: 1,
      approvedQuantity: 1,
      expectedAmount: 999,
      refundAmount: 999,
      discountAdjustment: 0,
      shippingAdjustment: 0,
      receivedAt: todayStr,
      receivedBy: "Muthu Kumar",
      receivingNote: "Parcel in original packaging.",
      qc: {
        id: "qc-4",
        condition: "Good",
        qcResult: "Approved",
        inventoryDisposition: "Restock",
        qcNotes: "Minor thread issue trimmed and approved for restock.",
        checkedBy: "Karthik Rajan",
        checkedAt: todayStr,
      },
      refund: {
        id: "ref-4",
        refundStatus: "Pending",
        refundAmount: 999,
        refundMethod: "UPI",
        refundNotes: "Awaiting finance approval for UPI transfer",
      },
      items: [
        {
          id: "rtn-it-4",
          orderItemId: o4.items[0]?.id || "it-4",
          productName: "Bandhani Print Rayon Flared Kurta",
          sku: "OF-BDH-FLR-04",
          color: "Maroon",
          size: "L",
          purchasedQuantity: 1,
          requestedQuantity: 1,
          receivedQuantity: 1,
          approvedQuantity: 1,
          unitPrice: 999,
          returnAmount: 999,
        },
      ],
      timeline: [
        {
          id: "tl-rtn-4-1",
          returnId: "rtn-case-4",
          action: "Return Requested",
          user: "Admin",
          role: "ADMIN",
          notes: "Customer reported quality defect",
          timestamp: yesterdayStr,
        },
        {
          id: "tl-rtn-4-2",
          returnId: "rtn-case-4",
          action: "Return Received",
          user: "Muthu Kumar",
          role: "PACKING_STAFF",
          notes: "Package checked in",
          timestamp: todayStr,
        },
        {
          id: "tl-rtn-4-3",
          returnId: "rtn-case-4",
          action: "QC Approved",
          user: "Karthik Rajan",
          role: "MANAGER",
          notes: "QC passed - condition Good, approved for restock",
          timestamp: todayStr,
        },
        {
          id: "tl-rtn-4-4",
          returnId: "rtn-case-4",
          action: "Refund Pending",
          user: "System",
          role: "SYSTEM",
          notes: "Refund task queued for finance",
          timestamp: todayStr,
        },
      ],
      createdAt: yesterdayStr,
      updatedAt: todayStr,
      createdBy: "Admin",
    },
    {
      id: "rtn-case-5",
      returnId: "RTN-260923-005",
      orderId: o5.id,
      orderNumber: o5.orderNumber,
      customerId: o5.customer.id,
      customerName: o5.customer.name,
      customerPhone: o5.customer.mobile,
      returnType: "Replacement",
      reason: "Size Issue",
      customerNote: "Need size L instead of size M.",
      status: "Replacement Pending",
      requestedQuantity: 1,
      receivedQuantity: 1,
      approvedQuantity: 1,
      expectedAmount: 2499,
      refundAmount: 0,
      discountAdjustment: 0,
      shippingAdjustment: 0,
      receivedAt: todayStr,
      receivedBy: "Muthu Kumar",
      receivingNote: "Original tags intact.",
      qc: {
        id: "qc-5",
        condition: "Good",
        qcResult: "Approved",
        inventoryDisposition: "Restock",
        qcNotes: "Garment is brand new with all tags intact. Restocked to shelf.",
        checkedBy: "Karthik Rajan",
        checkedAt: todayStr,
      },
      replacement: {
        id: "rep-5",
        replacementId: "REP-260923-001",
        originalOrderId: o5.id,
        originalOrderNumber: o5.orderNumber,
        originalItemName: "Chanderi Silk Anarkali Kurta Set - M",
        returnedItem: "Chanderi Silk Anarkali Kurta Set - M",
        replacementItem: "Chanderi Silk Anarkali Kurta Set - L",
        color: "Royal Blue",
        size: "L",
        quantity: 1,
        status: "Waiting for Packing",
      },
      items: [
        {
          id: "rtn-it-5",
          orderItemId: o5.items[0]?.id || "it-5",
          productName: "Chanderi Silk Anarkali Kurta Set",
          sku: "OF-CS-ANR-01",
          color: "Royal Blue",
          size: "M",
          purchasedQuantity: 1,
          requestedQuantity: 1,
          receivedQuantity: 1,
          approvedQuantity: 1,
          unitPrice: 2499,
          returnAmount: 2499,
        },
      ],
      timeline: [
        {
          id: "tl-rtn-5-1",
          returnId: "rtn-case-5",
          action: "Return Requested",
          user: "Deepa Verma",
          role: "ORDER_STAFF",
          notes: "Size exchange requested",
          timestamp: yesterdayStr,
        },
        {
          id: "tl-rtn-5-2",
          returnId: "rtn-case-5",
          action: "Return Received",
          user: "Muthu Kumar",
          role: "PACKING_STAFF",
          notes: "Parcel received",
          timestamp: todayStr,
        },
        {
          id: "tl-rtn-5-3",
          returnId: "rtn-case-5",
          action: "QC Approved",
          user: "Karthik Rajan",
          role: "MANAGER",
          notes: "Items in perfect condition, restocked",
          timestamp: todayStr,
        },
        {
          id: "tl-rtn-5-4",
          returnId: "rtn-case-5",
          action: "Replacement Created",
          user: "Karthik Rajan",
          role: "MANAGER",
          notes: "Replacement Order REP-260923-001 created and sent to Packing Station",
          timestamp: todayStr,
        },
      ],
      createdAt: yesterdayStr,
      updatedAt: todayStr,
      createdBy: "Deepa Verma",
    },
    {
      id: "rtn-case-6",
      returnId: "RTN-260922-006",
      orderId: o6.id,
      orderNumber: o6.orderNumber,
      customerId: o6.customer.id,
      customerName: o6.customer.name,
      customerPhone: o6.customer.mobile,
      returnType: "Refund",
      reason: "Damaged Product",
      customerNote: "Torn seam upon delivery.",
      status: "Completed",
      requestedQuantity: 1,
      receivedQuantity: 1,
      approvedQuantity: 1,
      expectedAmount: 2199,
      refundAmount: 2199,
      discountAdjustment: 0,
      shippingAdjustment: 0,
      receivedAt: twoDaysAgoStr,
      receivedBy: "Suresh Dispatch",
      receivingNote: "Torn package received back.",
      qc: {
        id: "qc-6",
        condition: "Damaged",
        qcResult: "Approved",
        inventoryDisposition: "Damaged Stock",
        qcNotes: "Confirmed damaged fabric. Transferred to damaged bin.",
        checkedBy: "Admin",
        checkedAt: twoDaysAgoStr,
      },
      refund: {
        id: "ref-6",
        refundStatus: "Refunded",
        refundAmount: 2199,
        refundMethod: "Bank Transfer",
        utrReference: "UTR982347192837",
        refundNotes: "NEFT transferred to customer account",
        processedBy: "Admin",
        refundDate: yesterdayStr,
      },
      items: [
        {
          id: "rtn-it-6",
          orderItemId: o6.items[0]?.id || "it-6",
          productName: "Raw Denim Selvedge Relaxed Fit Jeans",
          sku: "OF-DNM-SLV-09",
          color: "Indigo",
          size: "XL",
          purchasedQuantity: 1,
          requestedQuantity: 1,
          receivedQuantity: 1,
          approvedQuantity: 1,
          unitPrice: 2199,
          returnAmount: 2199,
        },
      ],
      timeline: [
        {
          id: "tl-rtn-6-1",
          returnId: "rtn-case-6",
          action: "Return Requested",
          user: "Admin",
          role: "ADMIN",
          notes: "Customer reported transit damage",
          timestamp: twoDaysAgoStr,
        },
        {
          id: "tl-rtn-6-2",
          returnId: "rtn-case-6",
          action: "Return Received",
          user: "Suresh Dispatch",
          role: "DISPATCH_STAFF",
          notes: "Arrived at hub",
          timestamp: twoDaysAgoStr,
        },
        {
          id: "tl-rtn-6-3",
          returnId: "rtn-case-6",
          action: "QC Approved",
          user: "Admin",
          role: "ADMIN",
          notes: "Damaged stock disposition approved",
          timestamp: twoDaysAgoStr,
        },
        {
          id: "tl-rtn-6-4",
          returnId: "rtn-case-6",
          action: "Refund Completed",
          user: "Admin",
          role: "ADMIN",
          notes: "Refund processed via Bank Transfer UTR: UTR982347192837",
          timestamp: yesterdayStr,
        },
        {
          id: "tl-rtn-6-5",
          returnId: "rtn-case-6",
          action: "Return Closed",
          user: "Admin",
          role: "ADMIN",
          notes: "Case closed successfully",
          timestamp: yesterdayStr,
        },
      ],
      createdAt: twoDaysAgoStr,
      updatedAt: yesterdayStr,
      createdBy: "Admin",
    },
  ];
}

