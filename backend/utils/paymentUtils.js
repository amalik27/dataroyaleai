const getOrderAmount = (credits_purchased) => {
    //calculates order total
    const exchange_rate = 5 // 20 credits for 1 dollar (100 cents)
    order = credits_purchased * exchange_rate;
    console.log(order)
    return order;
  };

  // Test Comment
  //other test comment here

module.exports = {
    getOrderAmount
}