# Node_PizzaSite
Implements a basic NodeJS server for Pizza Delivery

# Before you start
* Make sure that you set all the API keys in config.js file
* Run npm install

# Quick Guide
This project implements the following functionality (some additional functions were implemented as well):

1. New users can be created, their information can be edited, and they can be deleted.
System stores their name, email address, and street address.

2. There could be an admin user that can CRUD menu items. Put such users in 'admin' folder

3. There's a menu items storage implemeted. Each menu item has the following params:
  - Id
  - Name
  - Description
  - Category: {pizza, drink, snack, sauce} by default (however, it could be easily adjusted/extended)
  - Price
  - Available stock

4. Users and admin can log in and log out by creating or destroying a token.

5. When a user is logged in, they are able to GET all the possible menu items.
- Logged in users are be able to filter the menu items by the following params:
-- Price (more than, less than)
-- Category

6. A logged-in user are be able to fill a shopping cart with menu items:
- add item to cart
- delete item from cart
- get the cart

7. A logged-in user are be able to create an order (payment via Stripe API - provide keys in config.js)

8. When an order is placed, user get an email with receipt (email via Mailgun API - provide keys in config.js)

7. Once an order is placed, it is saved as a separate object in /orders folder, user's cart gets removed

8. Once an order is placed, all products of that order have their Available stock reduced accordingly

9. There is a validation before an order is placed that the products have not run out of stock

----

You may also find a Postman collection at /postman folder and data structure with examples at ./.data
