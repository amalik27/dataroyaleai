const getOrderAmount = (credits_purchased) => {
    //calculates order total
    const exchange_rate = 5 * 20 // 20 credits for 1 dollar (100 cents)
    order = credits_purchased * exchange_rate;
    return order;
};

const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  
    // These options are needed to round to whole numbers if that's what you want.
    //minimumFractionDigits: 0, // (this suffices for whole numbers, but will print 2500.10 as $2,500.1)
    //maximumFractionDigits: 0, // (causes 2500.99 to be printed as $2,501)
});

let slider = document.getElementById("steps-range");
let credit_text = document.getElementById("credits-text")
let price_text = document.getElementById("price-text")
let price = 250;
let credits = 2.5;
credit_text.innerText = credits * 20 + " credits";
price_text.innerText = formatter.format(price/100); // TODO: shorten to 2 decimal places
//credit_text.innerText = credits;
//price_text.innerText = price/100; // TODO: shorten to 2 decimal places
slider.addEventListener("change", selector);

function selector() {
    credits = document.getElementById("steps-range").value;
    console.log(credits);
    price = getOrderAmount(credits);
    credit_text.innerText = credits * 20 + " credits";
    price_text.innerText = formatter.format(price/100); // TODO: shorten to 2 decimal places
}

document.getElementById('submit-btn').addEventListener('click', function() {
    let credits = document.getElementById('steps-range').value;
    credits = credits * 20;
    //let price = getOrderAmount(credits);
    localStorage.setItem('orderAmount', credits);

    window.location.href = 'http://127.0.0.1:5500/frontend/public/checkout/checkout.html';
});
